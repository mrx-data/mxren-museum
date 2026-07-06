import type { User } from "@supabase/supabase-js";
import { categories, type Artifact, type ArtifactCategory } from "./collection";
import { getSupabaseClient, isSupabaseConfigured, SUPABASE_ARTIFACT_BUCKET } from "./supabase-client";

export const LOCAL_ARTIFACT_STORAGE_KEY = "mxren-museum.local-artifacts.v1";
export { isSupabaseConfigured };

export type ManagedSource = "local" | "remote";
export type PersistenceMode = "local" | "supabase";
type ArtifactGalleryImage = Artifact["galleryImages"][number];

export type GalleryImageInput = {
  src: string;
  alt?: string;
  label?: string;
  storagePath?: string;
};

export type ArtifactFormInput = {
  id?: string;
  title: string;
  category: ArtifactCategory;
  year: string;
  medium: string;
  rarity: string;
  featured: boolean;
  coverImage?: string;
  coverAlt?: string;
  coverFile?: File | null;
  coverStoragePath?: string;
  galleryImages: GalleryImageInput[];
  galleryFiles?: File[];
  summary: string;
  note: string;
};

export type ManagedArtifact = Artifact & {
  source: ManagedSource;
  updatedAt: string;
  ownerId?: string;
};

export type ArtifactLoadResult = {
  artifacts: ManagedArtifact[];
  mode: PersistenceMode;
  message: string;
  error?: Error;
};

type StoredArtifact = ManagedArtifact;

type ArtifactRow = {
  id: string;
  owner_id: string | null;
  title: string;
  category: string;
  category_label: string | null;
  volume: string | null;
  year: string | null;
  medium: string | null;
  rarity: string | null;
  featured: boolean | null;
  symbol: string | null;
  cover_alt: string | null;
  cover_image: string | null;
  cover_storage_path: string | null;
  gallery_images: unknown;
  palette: Artifact["palette"] | null;
  summary: string | null;
  note: string | null;
  updated_at: string | null;
};

const defaultGalleryLabels = ["细节", "记忆", "图板"];

const defaultPaletteByCategory: Record<ArtifactCategory, Artifact["palette"]> = {
  games: {
    from: "#1B1111",
    via: "#6F2330",
    to: "#B8953F",
    accent: "#C9A962"
  },
  landscapes: {
    from: "#12201B",
    via: "#355845",
    to: "#B58E47",
    accent: "#A7C08B"
  },
  "personal-works": {
    from: "#231A16",
    via: "#6A2633",
    to: "#C9A962",
    accent: "#E8DFD4"
  }
};

const symbolByCategory: Record<ArtifactCategory, string> = {
  games: "♜",
  landscapes: "◇",
  "personal-works": "✦"
};

function getStorage(storage?: Storage) {
  if (storage) return storage;
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isManagedArtifact(value: unknown): value is ManagedArtifact {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.category === "string" &&
    typeof value.summary === "string" &&
    typeof value.note === "string" &&
    (value.source === "local" || value.source === "remote")
  );
}

function isArtifactCategory(value: string): value is ArtifactCategory {
  return value === "games" || value === "landscapes" || value === "personal-works";
}

function categoryLabel(category: ArtifactCategory) {
  return categories.find((item) => item.id === category)?.label ?? "个人藏品";
}

function normalizeText(value: string) {
  return value.trim();
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "artifact";
}

function uniqueId(title: string, existing: Artifact[]) {
  const base = `local-${slugify(title)}`;
  if (!existing.some((artifact) => artifact.id === base)) return base;

  let index = 2;
  while (existing.some((artifact) => artifact.id === `${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
}

function remoteId() {
  return globalThis.crypto?.randomUUID?.() ?? `remote-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function volumeForManagedArtifact(existing: Artifact[], source: ManagedSource) {
  const prefix = source === "remote" ? "C" : "L";
  const count = existing.filter((artifact) => artifact.source === source).length + 1;
  return `${prefix}${String(count).padStart(2, "0")}`;
}

function normalizeGalleryImages(input: ArtifactFormInput, uploadedImages?: GalleryImageInput[]): ArtifactGalleryImage[] {
  if (uploadedImages) {
    return uploadedImages.slice(0, 3).map((image, index) => ({
      src: normalizeText(image.src),
      alt: normalizeText(image.alt ?? "") || `${normalizeText(input.title)} 的详情图片 ${index + 1}`,
      label: normalizeText(image.label ?? "") || defaultGalleryLabels[index] || `图 ${index + 1}`,
      storagePath: normalizeText(image.storagePath ?? "") || undefined
    }));
  }

  return input.galleryImages
    .filter((image) => normalizeText(image.src).length > 0)
    .slice(0, 3)
    .map((image, index) => ({
      src: normalizeText(image.src),
      alt: normalizeText(image.alt ?? "") || `${normalizeText(input.title)} 的详情图片 ${index + 1}`,
      label: normalizeText(image.label ?? "") || defaultGalleryLabels[index] || `图 ${index + 1}`,
      storagePath: normalizeText(image.storagePath ?? "") || undefined
    }));
}

function artifactFromInput(
  input: ArtifactFormInput,
  existing: Artifact[],
  id: string,
  source: ManagedSource,
  options: {
    coverImage?: string;
    coverStoragePath?: string;
    galleryImages?: GalleryImageInput[];
    ownerId?: string;
    volume?: string;
  } = {}
): ManagedArtifact {
  const title = normalizeText(input.title);
  const category = input.category;
  const now = new Date().toISOString();

  return {
    id,
    title,
    category,
    categoryLabel: categoryLabel(category),
    volume: options.volume ?? volumeForManagedArtifact(existing, source),
    year: normalizeText(input.year) || String(new Date().getFullYear()),
    medium: normalizeText(input.medium) || "Digital Artifact",
    rarity: normalizeText(input.rarity) || (source === "remote" ? "云端馆藏" : "本地馆藏"),
    featured: input.featured,
    symbol: symbolByCategory[category],
    coverAlt: normalizeText(input.coverAlt ?? "") || `${title} 的藏品封面`,
    coverImage: normalizeText(options.coverImage ?? input.coverImage ?? ""),
    coverStoragePath: normalizeText(options.coverStoragePath ?? input.coverStoragePath ?? "") || undefined,
    galleryImages: normalizeGalleryImages(input, options.galleryImages),
    palette: defaultPaletteByCategory[category],
    summary: normalizeText(input.summary),
    note: normalizeText(input.note),
    source,
    ownerId: options.ownerId,
    updatedAt: now
  };
}

function galleryFromUnknown(value: unknown, title: string): ArtifactGalleryImage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .slice(0, 3)
    .map((image, index) => ({
      src: typeof image.src === "string" ? image.src : "",
      alt:
        typeof image.alt === "string" && image.alt.trim()
          ? image.alt
          : `${title} 的详情图片 ${index + 1}`,
      label:
        typeof image.label === "string" && image.label.trim()
          ? image.label
          : defaultGalleryLabels[index] || `图 ${index + 1}`,
      storagePath: typeof image.storagePath === "string" && image.storagePath.trim() ? image.storagePath : undefined
    }))
    .filter((image) => image.src.trim().length > 0);
}

function artifactFromRow(row: ArtifactRow): ManagedArtifact {
  const category = isArtifactCategory(row.category) ? row.category : "personal-works";
  const title = row.title.trim() || "未命名藏品";

  return {
    id: row.id,
    title,
    category,
    categoryLabel: row.category_label?.trim() || categoryLabel(category),
    volume: row.volume?.trim() || "C00",
    year: row.year?.trim() || String(new Date().getFullYear()),
    medium: row.medium?.trim() || "Digital Artifact",
    rarity: row.rarity?.trim() || "云端馆藏",
    featured: Boolean(row.featured),
    symbol: row.symbol?.trim() || symbolByCategory[category],
    coverAlt: row.cover_alt?.trim() || `${title} 的藏品封面`,
    coverImage: row.cover_image?.trim() || "",
    coverStoragePath: row.cover_storage_path?.trim() || undefined,
    galleryImages: galleryFromUnknown(row.gallery_images, title),
    palette: row.palette ?? defaultPaletteByCategory[category],
    summary: row.summary?.trim() || "",
    note: row.note?.trim() || "",
    source: "remote",
    ownerId: row.owner_id ?? undefined,
    updatedAt: row.updated_at ?? new Date().toISOString()
  };
}

function rowFromArtifact(artifact: ManagedArtifact, ownerId: string) {
  return {
    id: artifact.id,
    owner_id: ownerId,
    title: artifact.title,
    category: artifact.category,
    category_label: artifact.categoryLabel,
    volume: artifact.volume,
    year: artifact.year,
    medium: artifact.medium,
    rarity: artifact.rarity,
    featured: artifact.featured,
    symbol: artifact.symbol,
    cover_alt: artifact.coverAlt,
    cover_image: artifact.coverImage,
    cover_storage_path: artifact.coverStoragePath ?? null,
    gallery_images: artifact.galleryImages,
    palette: artifact.palette,
    summary: artifact.summary,
    note: artifact.note
  };
}

function safeFileName(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const base = file.name.replace(/\.[^.]+$/, "");
  return `${slugify(base)}.${extension}`;
}

async function uploadArtifactImage(user: User, artifactId: string, kind: string, file: File, index = 0) {
  const supabase = getSupabaseClient();
  const path = `${user.id}/${artifactId}/${Date.now()}-${kind}-${index}-${safeFileName(file)}`;
  const { error } = await supabase.storage.from(SUPABASE_ARTIFACT_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type || "application/octet-stream",
    upsert: true
  });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(SUPABASE_ARTIFACT_BUCKET).getPublicUrl(path);
  return { src: data.publicUrl, storagePath: path };
}

async function coverFromInput(input: ArtifactFormInput, user: User, artifactId: string) {
  if (!input.coverFile) {
    return {
      src: normalizeText(input.coverImage ?? ""),
      storagePath: normalizeText(input.coverStoragePath ?? "") || undefined
    };
  }

  return uploadArtifactImage(user, artifactId, "cover", input.coverFile);
}

async function galleryFromInput(input: ArtifactFormInput, user: User, artifactId: string) {
  const normalized = normalizeGalleryImages(input);
  const files = input.galleryFiles ?? [];
  const count = Math.max(normalized.length, files.length);
  const gallery: GalleryImageInput[] = [];

  for (let index = 0; index < Math.min(count, 3); index += 1) {
    const current = normalized[index];
    const file = files[index];
    if (file) {
      const uploaded = await uploadArtifactImage(user, artifactId, "gallery", file, index + 1);
      gallery.push({
        src: uploaded.src,
        alt: current?.alt || `${normalizeText(input.title)} 的详情图片 ${index + 1}`,
        label: current?.label || defaultGalleryLabels[index] || `图 ${index + 1}`,
        storagePath: uploaded.storagePath
      });
      continue;
    }

    if (current) gallery.push(current);
  }

  return gallery;
}

function collectStoragePaths(artifact?: ManagedArtifact) {
  if (!artifact) return [];
  return [
    artifact.coverStoragePath,
    ...artifact.galleryImages.map((image) => image.storagePath)
  ].filter((path): path is string => Boolean(path));
}

export function loadLocalArtifacts(storage?: Storage): ManagedArtifact[] {
  const target = getStorage(storage);
  if (!target) return [];

  try {
    const raw = target.getItem(LOCAL_ARTIFACT_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isManagedArtifact).map((artifact) => ({ ...artifact, source: "local" }));
  } catch {
    return [];
  }
}

export function saveLocalArtifacts(artifacts: ManagedArtifact[], storage?: Storage) {
  const target = getStorage(storage);
  if (!target) return;
  const stored: StoredArtifact[] = artifacts
    .filter((artifact) => artifact.source === "local")
    .map((artifact) => ({ ...artifact, source: "local" }));
  target.setItem(LOCAL_ARTIFACT_STORAGE_KEY, JSON.stringify(stored));
}

export function createLocalArtifact(input: ArtifactFormInput, existing: Artifact[]): ManagedArtifact {
  return artifactFromInput(input, existing, uniqueId(input.title, existing), "local");
}

export function updateLocalArtifact(
  id: string,
  input: ArtifactFormInput,
  existing: ManagedArtifact[]
): ManagedArtifact[] {
  return existing.map((artifact) => {
    if (artifact.id !== id) return artifact;
    return {
      ...artifactFromInput(input, existing, id, "local", { volume: artifact.volume }),
      source: "local"
    };
  });
}

export function deleteLocalArtifact(id: string, existing: ManagedArtifact[]): ManagedArtifact[] {
  return existing.filter((artifact) => artifact.id !== id);
}

export async function loadRemoteArtifacts(): Promise<ManagedArtifact[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("artifacts")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as ArtifactRow[]).map(artifactFromRow);
}

export async function loadManagedArtifacts(storage?: Storage): Promise<ArtifactLoadResult> {
  if (!isSupabaseConfigured()) {
    return {
      artifacts: loadLocalArtifacts(storage),
      mode: "local",
      message: "browser-local storage"
    };
  }

  try {
    return {
      artifacts: await loadRemoteArtifacts(),
      mode: "supabase",
      message: "supabase cloud storage"
    };
  } catch (error) {
    return {
      artifacts: loadLocalArtifacts(storage),
      mode: "local",
      message: "supabase unavailable, browser-local fallback",
      error: error instanceof Error ? error : new Error("Supabase unavailable")
    };
  }
}

export async function getRemoteUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

export async function signInRemoteUser(email: string, password: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data.user;
}

export async function signOutRemoteUser() {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export function onRemoteAuthChange(callback: (user: User | null) => void) {
  if (!isSupabaseConfigured()) return () => undefined;
  const supabase = getSupabaseClient();
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });

  return () => data.subscription.unsubscribe();
}

export async function createRemoteArtifact(
  input: ArtifactFormInput,
  existing: Artifact[],
  user: User
): Promise<ManagedArtifact> {
  const supabase = getSupabaseClient();
  const id = input.id ?? remoteId();
  const cover = await coverFromInput(input, user, id);
  const galleryImages = await galleryFromInput(input, user, id);
  const artifact = artifactFromInput(input, existing, id, "remote", {
    coverImage: cover.src,
    coverStoragePath: cover.storagePath,
    galleryImages,
    ownerId: user.id
  });

  const { data, error } = await supabase
    .from("artifacts")
    .insert(rowFromArtifact(artifact, user.id))
    .select()
    .single();

  if (error) throw new Error(error.message);
  return artifactFromRow(data as ArtifactRow);
}

export async function updateRemoteArtifact(
  id: string,
  input: ArtifactFormInput,
  existing: ManagedArtifact[],
  user: User
): Promise<ManagedArtifact> {
  const supabase = getSupabaseClient();
  const current = existing.find((artifact) => artifact.id === id);
  const cover = await coverFromInput(input, user, id);
  const galleryImages = await galleryFromInput(input, user, id);
  const artifact = artifactFromInput(input, existing, id, "remote", {
    coverImage: cover.src,
    coverStoragePath: cover.storagePath,
    galleryImages,
    ownerId: user.id,
    volume: current?.volume
  });

  const { data, error } = await supabase
    .from("artifacts")
    .update(rowFromArtifact(artifact, user.id))
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return artifactFromRow(data as ArtifactRow);
}

export async function deleteRemoteArtifact(id: string, artifact?: ManagedArtifact) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("artifacts").delete().eq("id", id);
  if (error) throw new Error(error.message);

  const storagePaths = collectStoragePaths(artifact);
  if (storagePaths.length > 0) {
    await supabase.storage.from(SUPABASE_ARTIFACT_BUCKET).remove(storagePaths);
  }
}

export function queryArtifacts(
  artifacts: Artifact[],
  query: string,
  filter: "all" | ArtifactCategory
): Artifact[] {
  const normalizedQuery = query.trim().toLowerCase();
  return artifacts.filter((artifact) => {
    const categoryMatches = filter === "all" || artifact.category === filter;
    if (!categoryMatches) return false;
    if (!normalizedQuery) return true;

    return [
      artifact.title,
      artifact.categoryLabel,
      artifact.year,
      artifact.medium,
      artifact.rarity,
      artifact.summary,
      artifact.note
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
}
