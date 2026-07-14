import { getSupabaseClient, supabasePublishableKey, supabaseUrl, SUPABASE_ARTIFACT_BUCKET } from "./supabase-client";

const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_GIF_BYTES = 5 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 25_000_000;
const LONG_CACHE_SECONDS = "31536000";
const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

type ImageVariant = "display" | "thumbnail";

type PreparedImage = {
  assetId: string;
  variant: ImageVariant;
  extension: "webp" | "gif";
  contentType: "image/webp" | "image/gif";
  blob: Blob;
};

type SignedUpload = {
  path: string;
  token: string;
};

export type UploadedImage = {
  displayPath: string;
  displayUrl: string;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  uploadedPaths: string[];
};

function uuid() {
  if (!globalThis.crypto?.randomUUID) throw new Error("当前浏览器不支持安全的图片上传标识");
  return globalThis.crypto.randomUUID();
}

function edgeFunctionUrl() {
  return `${supabaseUrl}/functions/v1/artifact-images`;
}

function edgeHeaders(sessionToken: string) {
  return {
    apikey: supabasePublishableKey,
    Authorization: `Bearer ${supabasePublishableKey}`,
    "Content-Type": "application/json",
    "X-Museum-Session": sessionToken
  };
}

export function publicArtifactImageUrl(path?: string) {
  if (!path) return "";
  const { data } = getSupabaseClient().storage.from(SUPABASE_ARTIFACT_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function artifactStoragePaths(artifact: {
  coverStoragePath?: string;
  coverThumbnailStoragePath?: string;
  galleryImages: Array<{ storagePath?: string }>;
}) {
  return [
    artifact.coverStoragePath,
    artifact.coverThumbnailStoragePath,
    ...artifact.galleryImages.map((image) => image.storagePath)
  ].filter((path): path is string => Boolean(path));
}

export function validateImageFile(file: File) {
  if (!supportedTypes.has(file.type)) {
    throw new Error("仅支持 JPEG、PNG、WebP 或 GIF 图片");
  }
  const limit = file.type === "image/gif" ? MAX_GIF_BYTES : MAX_INPUT_BYTES;
  if (file.size > limit) {
    throw new Error(file.type === "image/gif" ? "GIF 不能超过 5MB" : "图片不能超过 20MB");
  }
}

async function decodeImage(file: Blob) {
  const bitmap = await createImageBitmap(file);
  if (bitmap.width * bitmap.height > MAX_PIXELS) {
    bitmap.close();
    throw new Error("图片像素不能超过 2500 万");
  }
  return bitmap;
}

async function resizeAsWebp(file: Blob, maxWidth: number, maxHeight: number, quality: number) {
  const bitmap = await decodeImage(file);
  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    bitmap.close();
    throw new Error("当前浏览器无法处理图片");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (!blob || blob.type !== "image/webp") throw new Error("当前浏览器不支持 WebP 图片处理");
  if (blob.size > MAX_OUTPUT_BYTES) throw new Error("优化后的图片仍超过 5MB，请选择尺寸更小的图片");
  return blob;
}

async function prepareImage(file: File, includeThumbnail: boolean): Promise<PreparedImage[]> {
  validateImageFile(file);
  const assetId = uuid();
  const display =
    file.type === "image/gif"
      ? { blob: file, extension: "gif" as const, contentType: "image/gif" as const }
      : {
          blob: await resizeAsWebp(file, 1600, 1600, 0.86),
          extension: "webp" as const,
          contentType: "image/webp" as const
        };
  const prepared: PreparedImage[] = [{ assetId, variant: "display", ...display }];

  if (includeThumbnail) {
    prepared.push({
      assetId,
      variant: "thumbnail",
      extension: "webp",
      contentType: "image/webp",
      blob: await resizeAsWebp(file, 720, 960, 0.8)
    });
  }
  return prepared;
}

async function requestSignedUploads(artifactId: string, images: PreparedImage[], sessionToken: string) {
  const response = await fetch(edgeFunctionUrl(), {
    method: "POST",
    headers: edgeHeaders(sessionToken),
    body: JSON.stringify({
      artifactId,
      assets: images.map(({ assetId, variant, extension, contentType }) => ({
        assetId,
        variant,
        extension,
        contentType
      }))
    })
  });
  const payload = (await response.json().catch(() => null)) as { uploads?: SignedUpload[]; error?: string } | null;
  if (!response.ok || !payload?.uploads || payload.uploads.length !== images.length) {
    throw new Error(payload?.error || "无法获取图片上传授权");
  }
  return payload.uploads;
}

export async function uploadArtifactImage(
  artifactId: string,
  file: File,
  sessionToken: string,
  includeThumbnail: boolean
): Promise<UploadedImage> {
  const images = await prepareImage(file, includeThumbnail);
  const signedUploads = await requestSignedUploads(artifactId, images, sessionToken);
  const uploadedPaths: string[] = [];

  try {
    for (const [index, image] of images.entries()) {
      const upload = signedUploads[index];
      const { error } = await getSupabaseClient()
        .storage.from(SUPABASE_ARTIFACT_BUCKET)
        .uploadToSignedUrl(upload.path, upload.token, image.blob, {
          contentType: image.contentType,
          cacheControl: LONG_CACHE_SECONDS,
          upsert: false
        });
      if (error) throw new Error(error.message);
      uploadedPaths.push(upload.path);
    }
  } catch (error) {
    await deleteArtifactImages(artifactId, uploadedPaths, sessionToken).catch(() => undefined);
    throw error;
  }

  const displayPath = signedUploads[images.findIndex((image) => image.variant === "display")].path;
  const thumbnailIndex = images.findIndex((image) => image.variant === "thumbnail");
  const thumbnailPath = thumbnailIndex >= 0 ? signedUploads[thumbnailIndex].path : undefined;
  return {
    displayPath,
    displayUrl: publicArtifactImageUrl(displayPath),
    thumbnailPath,
    thumbnailUrl: publicArtifactImageUrl(thumbnailPath),
    uploadedPaths
  };
}

export async function deleteArtifactImages(artifactId: string, paths: string[], sessionToken: string) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (uniquePaths.length === 0) return;
  const response = await fetch(edgeFunctionUrl(), {
    method: "DELETE",
    headers: edgeHeaders(sessionToken),
    body: JSON.stringify({ artifactId, paths: uniquePaths })
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error || "图片清理失败");
}
