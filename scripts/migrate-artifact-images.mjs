import { randomUUID } from "node:crypto";
import process from "node:process";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const bucket = "artifact-images";
const selectedModes = ["--dry-run", "--execute", "--cleanup"].filter((flag) => process.argv.includes(flag));
if (selectedModes.length !== 1) throw new Error("Choose exactly one mode: --dry-run, --execute, or --cleanup");
const [mode] = selectedModes;
if (mode === "--cleanup" && !process.argv.includes("--backup-confirmed")) {
  throw new Error("Cleanup requires a verified database backup and the --backup-confirmed flag");
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const dataUrlPattern = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s;

function decodeDataUrl(value) {
  const match = value.match(dataUrlPattern);
  if (!match) return null;
  return { contentType: match[1], buffer: Buffer.from(match[2], "base64") };
}

async function webpVariant(buffer, width, height, quality) {
  return sharp(buffer, { failOn: "error", limitInputPixels: 25_000_000 })
    .rotate()
    .resize({ width, height, fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
}

async function upload(path, bytes, contentType) {
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error(`Processed object exceeds 5MB: ${path}`);
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType,
    cacheControl: "31536000",
    upsert: false
  });
  if (error) throw error;
}

async function migrateImage(artifactId, decoded, withThumbnail) {
  const assetId = randomUUID();
  const prefix = `artifacts/${artifactId}/${assetId}`;
  const isGif = decoded.contentType === "image/gif";
  const displayPath = `${prefix}/display.${isGif ? "gif" : "webp"}`;
  const displayBytes = isGif ? decoded.buffer : await webpVariant(decoded.buffer, 1600, 1600, 86);
  await upload(displayPath, displayBytes, isGif ? "image/gif" : "image/webp");

  let thumbnailPath;
  if (withThumbnail) {
    thumbnailPath = `${prefix}/thumbnail.webp`;
    await upload(thumbnailPath, await webpVariant(decoded.buffer, 720, 960, 80), "image/webp");
  }
  return { displayPath, thumbnailPath };
}

async function storageObjectExists(path) {
  const slash = path.lastIndexOf("/");
  const directory = path.slice(0, slash);
  const name = path.slice(slash + 1);
  const { data, error } = await supabase.storage.from(bucket).list(directory, { search: name, limit: 2 });
  if (error) throw error;
  return data.some((item) => item.name === name);
}

const { data: artifacts, error } = await supabase
  .from("artifacts")
  .select("id,title,cover_image,cover_storage_path,cover_thumbnail_storage_path,gallery_images")
  .order("created_at", { ascending: true });
if (error) throw error;

let pendingImages = 0;
for (const artifact of artifacts) {
  const cover = decodeDataUrl(artifact.cover_image || "");
  const gallery = Array.isArray(artifact.gallery_images) ? artifact.gallery_images : [];
  pendingImages += cover && !artifact.cover_storage_path ? 1 : 0;
  pendingImages += gallery.filter((image) => decodeDataUrl(typeof image?.src === "string" ? image.src : "") && !image.storagePath).length;
}
console.log(`${artifacts.length} artifact rows inspected; ${pendingImages} legacy images require migration.`);

if (mode === "--dry-run") process.exit(0);

if (mode === "--execute") {
  for (const artifact of artifacts) {
    const uploadedPaths = [];
    let coverStoragePath = artifact.cover_storage_path;
    let coverThumbnailStoragePath = artifact.cover_thumbnail_storage_path;
    const galleryImages = Array.isArray(artifact.gallery_images) ? structuredClone(artifact.gallery_images) : [];

    try {
      const cover = decodeDataUrl(artifact.cover_image || "");
      if (cover && !coverStoragePath) {
        const migrated = await migrateImage(artifact.id, cover, true);
        coverStoragePath = migrated.displayPath;
        coverThumbnailStoragePath = migrated.thumbnailPath;
        uploadedPaths.push(migrated.displayPath, migrated.thumbnailPath);
      }

      for (const image of galleryImages) {
        const decoded = decodeDataUrl(typeof image?.src === "string" ? image.src : "");
        if (!decoded || image.storagePath) continue;
        const migrated = await migrateImage(artifact.id, decoded, false);
        image.storagePath = migrated.displayPath;
        uploadedPaths.push(migrated.displayPath);
      }

      if (uploadedPaths.length > 0) {
        const { error: updateError } = await supabase
          .from("artifacts")
          .update({
            cover_storage_path: coverStoragePath,
            cover_thumbnail_storage_path: coverThumbnailStoragePath,
            gallery_images: galleryImages
          })
          .eq("id", artifact.id);
        if (updateError) throw updateError;
        console.log(`Migrated ${artifact.id}: ${uploadedPaths.length} objects.`);
      }
    } catch (migrationError) {
      if (uploadedPaths.length > 0) await supabase.storage.from(bucket).remove(uploadedPaths);
      throw new Error(`Migration stopped at artifact ${artifact.id}: ${migrationError.message}`);
    }
  }
  console.log("Migration complete. Verify production images before running cleanup.");
}

if (mode === "--cleanup") {
  for (const artifact of artifacts) {
    const cover = decodeDataUrl(artifact.cover_image || "");
    const galleryImages = Array.isArray(artifact.gallery_images) ? structuredClone(artifact.gallery_images) : [];
    if (cover && (!artifact.cover_storage_path || !artifact.cover_thumbnail_storage_path)) {
      throw new Error(`Cleanup blocked: cover paths are incomplete for ${artifact.id}`);
    }

    const paths = [artifact.cover_storage_path, artifact.cover_thumbnail_storage_path];
    for (const image of galleryImages) {
      const decoded = decodeDataUrl(typeof image?.src === "string" ? image.src : "");
      if (decoded && !image.storagePath) throw new Error(`Cleanup blocked: gallery path missing for ${artifact.id}`);
      if (image.storagePath) paths.push(image.storagePath);
    }
    for (const path of paths.filter(Boolean)) {
      if (!(await storageObjectExists(path))) throw new Error(`Cleanup blocked: Storage object missing at ${path}`);
    }

    const cleanedGallery = galleryImages.map((image) => ({
      ...image,
      src: image.storagePath ? "" : image.src
    }));
    const { error: cleanupError } = await supabase
      .from("artifacts")
      .update({ cover_image: artifact.cover_storage_path ? "" : artifact.cover_image, gallery_images: cleanedGallery })
      .eq("id", artifact.id);
    if (cleanupError) throw cleanupError;
  }
  console.log("Legacy Base64 cleanup complete.");
}
