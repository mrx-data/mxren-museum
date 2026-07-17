import {
  categories as defaultCategories,
  type Artifact,
  type ArtifactCategory,
  type ArtifactVisibility
} from "./collection";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client";
import {
  artifactStoragePaths,
  deleteArtifactImages,
  publicArtifactImageUrl,
  uploadArtifactImage,
  uploadArtifactImages
} from "./artifact-images";

export const LOCAL_ARTIFACT_STORAGE_KEY = "mxren-museum.local-artifacts.v1";
export const ADMIN_SESSION_STORAGE_KEY = "mxren-museum.admin-session.v1";
export { isSupabaseConfigured };

export type ManagedSource = "local" | "remote";
export type PersistenceMode = "local" | "supabase";
export type ArtifactSort = "catalog" | "date-desc" | "date-asc" | "updated-desc" | "title-asc";
type ArtifactGalleryImage = Artifact["galleryImages"][number];

export type ArtifactCategoryDefinition = {
  id: ArtifactCategory;
  label: string;
};

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
  categoryLabel: string;
  tags: string[];
  artifactDate?: string;
  year: string;
  medium: string;
  rarity: string;
  featured: boolean;
  visibility: ArtifactVisibility;
  coverImage?: string;
  coverAlt?: string;
  coverFile?: File | null;
  coverStoragePath?: string;
  coverThumbnailImage?: string;
  coverThumbnailStoragePath?: string;
  galleryImages: GalleryImageInput[];
  galleryFiles?: File[];
  summary: string;
  note: string;
};

export type ManagedArtifact = Artifact & {
  source: ManagedSource;
  updatedAt: string;
  ownerId?: string;
  remoteId?: string;
  sourceArtifactId?: string;
};

export type AdminSession = {
  username: string;
  displayName: string;
  token: string;
  expiresAt: string;
};

export type ArtifactLoadResult = {
  artifacts: ManagedArtifact[];
  mode: PersistenceMode;
  message: string;
  error?: Error;
};

export type ArtifactBatchPatch = {
  visibility?: ArtifactVisibility;
  category?: ArtifactCategory;
  categoryLabel?: string;
  tags?: string[];
  trash?: boolean;
};

export type ArtifactVersion = {
  id: number;
  artifactId: string;
  operation: "update" | "trash" | "restore" | "purge";
  title: string;
  visibility: ArtifactVisibility;
  createdAt: string;
};

type StoredArtifact = ManagedArtifact;

type ArtifactRow = {
  id: string;
  source_artifact_id: string | null;
  owner_id: string | null;
  title: string;
  category: string;
  category_label: string | null;
  tags?: unknown;
  artifact_date?: string | null;
  volume: string | null;
  year: string | null;
  medium: string | null;
  rarity: string | null;
  featured: boolean | null;
  visibility: string | null;
  symbol: string | null;
  cover_alt: string | null;
  cover_image: string | null;
  cover_storage_path: string | null;
  cover_thumbnail_storage_path: string | null;
  gallery_images: unknown;
  palette: Artifact["palette"] | null;
  summary: string | null;
  note: string | null;
  created_at?: string | null;
  updated_at: string | null;
  deleted_at?: string | null;
};

type AdminLoginRow = {
  username: string;
  display_name: string | null;
  token: string;
  expires_at: string;
};

type ArtifactCategoryRow = {
  id: string;
  label: string;
};

const defaultGalleryLabels = ["细节", "记忆", "图板"];

const defaultPaletteByCategory: Record<string, Artifact["palette"]> = {
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

const symbolByCategory: Record<string, string> = {
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
  return value.trim().length > 0 && value.length <= 64;
}

function categoryLabel(category: ArtifactCategory, preferredLabel = "") {
  return (
    preferredLabel.trim() ||
    defaultCategories.find((item) => item.id === category)?.label ||
    "个人藏品"
  );
}

function paletteForCategory(category: ArtifactCategory) {
  return defaultPaletteByCategory[category] ?? defaultPaletteByCategory["personal-works"];
}

function symbolForCategory(category: ArtifactCategory) {
  return symbolByCategory[category] ?? symbolByCategory["personal-works"];
}

function normalizeText(value: string) {
  return value.trim();
}

export function normalizeArtifactTags(values: string[] | string) {
  const source = Array.isArray(values) ? values : values.split(/[,，\n]/);
  const seen = new Set<string>();
  return source
    .map((value) => value.trim().replace(/^#+/, ""))
    .filter((value) => {
      const key = value.toLocaleLowerCase("zh-CN");
      if (!value || value.length > 24 || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

function normalizeArtifactDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? undefined : value;
}

function normalizeVisibility(value: unknown): ArtifactVisibility {
  return value === "draft" || value === "unlisted" ? value : "published";
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
    .filter((image) => normalizeText(image.src).length > 0 || normalizeText(image.storagePath ?? "").length > 0)
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
    coverThumbnailImage?: string;
    coverThumbnailStoragePath?: string;
    galleryImages?: GalleryImageInput[];
    ownerId?: string;
    volume?: string;
    remoteId?: string;
    sourceArtifactId?: string;
    palette?: Artifact["palette"];
    symbol?: string;
  } = {}
): ManagedArtifact {
  const title = normalizeText(input.title);
  const category = input.category;
  const now = new Date().toISOString();

  return {
    id,
    title,
    category,
    categoryLabel: categoryLabel(category, input.categoryLabel),
    tags: normalizeArtifactTags(input.tags),
    artifactDate: normalizeArtifactDate(input.artifactDate),
    volume: options.volume ?? volumeForManagedArtifact(existing, source),
    year: normalizeText(input.year) || normalizeArtifactDate(input.artifactDate)?.slice(0, 4) || String(new Date().getFullYear()),
    medium: normalizeText(input.medium) || "Digital Artifact",
    rarity: normalizeText(input.rarity) || (source === "remote" ? "云端馆藏" : "本地馆藏"),
    featured: input.featured,
    visibility: normalizeVisibility(input.visibility),
    symbol: options.symbol ?? symbolForCategory(category),
    coverAlt: normalizeText(input.coverAlt ?? "") || `${title} 的藏品封面`,
    coverImage: normalizeText(options.coverImage ?? input.coverImage ?? ""),
    coverStoragePath: normalizeText(options.coverStoragePath ?? input.coverStoragePath ?? "") || undefined,
    coverThumbnailImage:
      normalizeText(options.coverThumbnailImage ?? input.coverThumbnailImage ?? "") ||
      normalizeText(options.coverImage ?? input.coverImage ?? "") ||
      undefined,
    coverThumbnailStoragePath:
      normalizeText(options.coverThumbnailStoragePath ?? input.coverThumbnailStoragePath ?? "") || undefined,
    galleryImages: normalizeGalleryImages(input, options.galleryImages),
    palette: options.palette ?? paletteForCategory(category),
    summary: normalizeText(input.summary),
    note: normalizeText(input.note),
    source,
    ownerId: options.ownerId,
    remoteId: options.remoteId,
    sourceArtifactId: options.sourceArtifactId,
    createdAt: now,
    updatedAt: now
  };
}

function galleryFromUnknown(value: unknown, title: string): ArtifactGalleryImage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .slice(0, 3)
    .map((image, index) => {
      const storagePath = typeof image.storagePath === "string" && image.storagePath.trim() ? image.storagePath : undefined;
      return {
        src: storagePath ? publicArtifactImageUrl(storagePath) : typeof image.src === "string" ? image.src : "",
        alt:
          typeof image.alt === "string" && image.alt.trim()
            ? image.alt
            : `${title} 的详情图片 ${index + 1}`,
        label:
          typeof image.label === "string" && image.label.trim()
            ? image.label
            : defaultGalleryLabels[index] || `图 ${index + 1}`,
        storagePath
      };
    })
    .filter((image) => image.src.trim().length > 0);
}

function artifactFromRow(row: ArtifactRow): ManagedArtifact {
  const category = isArtifactCategory(row.category) ? row.category : "personal-works";
  const title = row.title.trim() || "未命名藏品";
  const sourceArtifactId = row.source_artifact_id?.trim() || undefined;

  const coverStoragePath = row.cover_storage_path?.trim() || undefined;
  const coverThumbnailStoragePath = row.cover_thumbnail_storage_path?.trim() || undefined;
  const coverImage = coverStoragePath ? publicArtifactImageUrl(coverStoragePath) : row.cover_image?.trim() || "";

  return {
    id: sourceArtifactId ?? row.id,
    title,
    category,
    categoryLabel: row.category_label?.trim() || categoryLabel(category),
    tags: Array.isArray(row.tags) ? normalizeArtifactTags(row.tags.filter((tag): tag is string => typeof tag === "string")) : [],
    artifactDate: normalizeArtifactDate(row.artifact_date),
    volume: row.volume?.trim() || "C00",
    year: row.year?.trim() || String(new Date().getFullYear()),
    medium: row.medium?.trim() || "Digital Artifact",
    rarity: row.rarity?.trim() || "云端馆藏",
    featured: Boolean(row.featured),
    visibility: normalizeVisibility(row.visibility),
    symbol: row.symbol?.trim() || symbolForCategory(category),
    coverAlt: row.cover_alt?.trim() || `${title} 的藏品封面`,
    coverImage,
    coverStoragePath,
    coverThumbnailImage: coverThumbnailStoragePath ? publicArtifactImageUrl(coverThumbnailStoragePath) : coverImage,
    coverThumbnailStoragePath,
    galleryImages: galleryFromUnknown(row.gallery_images, title),
    palette: row.palette ?? paletteForCategory(category),
    summary: row.summary?.trim() || "",
    note: row.note?.trim() || "",
    source: "remote",
    ownerId: row.owner_id ?? undefined,
    remoteId: row.id,
    sourceArtifactId,
    createdAt: row.created_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
    updatedAt: row.updated_at ?? new Date().toISOString()
  };
}

function rowFromArtifact(artifact: ManagedArtifact) {
  return {
    id: artifact.remoteId ?? artifact.id,
    source_artifact_id: artifact.sourceArtifactId ?? null,
    owner_id: artifact.ownerId ?? null,
    title: artifact.title,
    category: artifact.category,
    category_label: artifact.categoryLabel,
    tags: normalizeArtifactTags(artifact.tags),
    artifact_date: artifact.artifactDate ?? null,
    volume: artifact.volume,
    year: artifact.year,
    medium: artifact.medium,
    rarity: artifact.rarity,
    featured: artifact.featured,
    visibility: artifact.visibility,
    symbol: artifact.symbol,
    cover_alt: artifact.coverAlt,
    cover_image: artifact.coverStoragePath ? "" : artifact.coverImage,
    cover_storage_path: artifact.coverStoragePath ?? null,
    cover_thumbnail_storage_path: artifact.coverThumbnailStoragePath ?? null,
    gallery_images: artifact.galleryImages.map((image) => ({
      src: image.storagePath ? "" : image.src,
      alt: image.alt,
      label: image.label,
      storagePath: image.storagePath
    })),
    palette: artifact.palette,
    summary: artifact.summary,
    note: artifact.note
  };
}

export function loadLocalArtifacts(storage?: Storage): ManagedArtifact[] {
  const target = getStorage(storage);
  if (!target) return [];

  try {
    const raw = target.getItem(LOCAL_ARTIFACT_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isManagedArtifact).map((artifact) => ({
      ...artifact,
      tags: normalizeArtifactTags(Array.isArray(artifact.tags) ? artifact.tags : []),
      artifactDate: normalizeArtifactDate(artifact.artifactDate),
      visibility: normalizeVisibility(artifact.visibility),
      source: "local"
    }));
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

export function loadStoredAdminSession(storage?: Storage): AdminSession | null {
  const target = getStorage(storage);
  if (!target) return null;

  try {
    const raw = target.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    const session: AdminSession = {
      username: typeof parsed.username === "string" ? parsed.username : "",
      displayName: typeof parsed.displayName === "string" ? parsed.displayName : "",
      token: typeof parsed.token === "string" ? parsed.token : "",
      expiresAt: typeof parsed.expiresAt === "string" ? parsed.expiresAt : ""
    };

    if (!session.username || !session.token || !session.expiresAt) return null;
    if (Date.parse(session.expiresAt) <= Date.now()) {
      target.removeItem(ADMIN_SESSION_STORAGE_KEY);
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function storeAdminSession(session: AdminSession, storage?: Storage) {
  const target = getStorage(storage);
  if (!target) return;
  target.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredAdminSession(storage?: Storage) {
  getStorage(storage)?.removeItem(ADMIN_SESSION_STORAGE_KEY);
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

function defaultArtifactCategories(): ArtifactCategoryDefinition[] {
  return defaultCategories
    .filter((category) => category.id !== "all")
    .map((category) => ({ id: category.id, label: category.label }));
}

export async function loadArtifactCategories(): Promise<ArtifactCategoryDefinition[]> {
  if (!isSupabaseConfigured()) return defaultArtifactCategories();

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("museum_categories")
    .select("id,label")
    .order("sort_order", { ascending: true });

  if (error) return defaultArtifactCategories();

  const categoriesById = new Map(defaultArtifactCategories().map((category) => [category.id, category]));
  (data as ArtifactCategoryRow[]).forEach((category) => {
    const id = category.id?.trim();
    const label = category.label?.trim();
    if (id && label) categoriesById.set(id, { id, label });
  });
  return [...categoriesById.values()];
}

export async function saveRemoteArtifactCategory(
  id: ArtifactCategory,
  label: string,
  session: AdminSession
): Promise<ArtifactCategoryDefinition> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("save_museum_category", {
    input_session_token: session.token,
    input_category_id: id,
    input_category_label: label
  });

  if (error) throw new Error(error.message);
  const row = data as ArtifactCategoryRow;
  return { id: row.id, label: row.label };
}

const legacyArtifactSelectFields =
  "id,source_artifact_id,owner_id,title,category,category_label,volume,year,medium,rarity,featured,symbol,cover_alt,cover_image,cover_storage_path,cover_thumbnail_storage_path,gallery_images,palette,summary,note,updated_at";

export async function loadRemoteArtifacts(session: AdminSession | null = null): Promise<ManagedArtifact[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("load_museum_artifacts", {
    input_session_token: session?.token ?? null
  });

  if (!error) return (data as ArtifactRow[]).map(artifactFromRow);

  // Keep the site readable while the visibility migration is being rolled out.
  const legacyResult = await supabase
    .from("artifacts")
    .select(legacyArtifactSelectFields)
    .order("created_at", { ascending: true });

  if (legacyResult.error) throw new Error(error.message);
  return (legacyResult.data as unknown as ArtifactRow[]).map(artifactFromRow);
}

export async function loadRemoteTrash(session: AdminSession): Promise<ManagedArtifact[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("load_museum_trash", {
    input_session_token: session.token
  });
  if (error) throw new Error(error.message);
  return (data as ArtifactRow[]).map(artifactFromRow);
}

export async function loadHiddenSourceArtifactIds(): Promise<string[] | null> {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("load_museum_hidden_source_artifact_ids");
  if (error) return null;

  return (data as Array<{ source_artifact_id: string | null }>)
    .map((row) => row.source_artifact_id?.trim() ?? "")
    .filter(Boolean);
}

export async function loadRemoteArtifactById(
  id: string,
  session: AdminSession | null = null
): Promise<ManagedArtifact | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("load_museum_artifact", {
    input_artifact_id: id,
    input_session_token: session?.token ?? null
  });

  if (error) throw new Error(error.message);
  const row = (data as ArtifactRow[])[0];
  return row ? artifactFromRow(row) : null;
}

export async function loadManagedArtifacts(
  storage?: Storage,
  session: AdminSession | null = null
): Promise<ArtifactLoadResult> {
  if (!isSupabaseConfigured()) {
    return {
      artifacts: loadLocalArtifacts(storage),
      mode: "local",
      message: "browser-local storage"
    };
  }

  try {
    return {
      artifacts: await loadRemoteArtifacts(session),
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
  return loadStoredAdminSession();
}

export async function signInRemoteUser(username: string, password: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("verify_museum_admin_login", {
    input_username: username,
    input_password: password
  });
  if (error) throw new Error(error.message);

  const row = Array.isArray(data) ? (data[0] as AdminLoginRow | undefined) : (data as AdminLoginRow | null);
  if (!row?.token) throw new Error("管理员账号或密码错误");

  const session = {
    username: row.username,
    displayName: row.display_name?.trim() || row.username,
    token: row.token,
    expiresAt: row.expires_at
  };
  storeAdminSession(session);
  return session;
}

export async function signOutRemoteUser(session?: AdminSession | null) {
  const currentSession = session ?? loadStoredAdminSession();
  const supabase = getSupabaseClient();
  if (currentSession?.token) {
    const { error } = await supabase.rpc("clear_museum_admin_session", {
      input_session_token: currentSession.token
    });
    if (error) throw new Error(error.message);
  }
  clearStoredAdminSession();
}

export async function isRemoteAdmin(session: AdminSession | null) {
  if (!session || !isSupabaseConfigured()) return false;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("verify_museum_admin_session", {
    input_session_token: session.token
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export function onRemoteAuthChange(_callback: (session: AdminSession | null) => void) {
  return () => undefined;
}

async function uploadInputImages(
  artifactId: string,
  input: ArtifactFormInput,
  session: AdminSession
): Promise<{
  coverImage: string;
  coverStoragePath?: string;
  coverThumbnailImage?: string;
  coverThumbnailStoragePath?: string;
  galleryImages: GalleryImageInput[];
  uploadedPaths: string[];
}> {
  const uploadedPaths: string[] = [];
  let coverImage = input.coverImage ?? "";
  let coverStoragePath = input.coverStoragePath;
  let coverThumbnailImage = input.coverThumbnailImage;
  let coverThumbnailStoragePath = input.coverThumbnailStoragePath;
  let galleryImages = input.galleryImages;

  try {
    if (input.coverFile) {
      const uploadedCover = await uploadArtifactImage(artifactId, input.coverFile, session.token, true);
      uploadedPaths.push(...uploadedCover.uploadedPaths);
      coverImage = uploadedCover.displayUrl;
      coverStoragePath = uploadedCover.displayPath;
      coverThumbnailImage = uploadedCover.thumbnailUrl ?? uploadedCover.displayUrl;
      coverThumbnailStoragePath = uploadedCover.thumbnailPath;
    }

    if (input.galleryFiles?.length) {
      galleryImages = [];
      const galleryFiles = input.galleryFiles.slice(0, 3);
      const uploadedGallery = await uploadArtifactImages(artifactId, galleryFiles, session.token);
      for (const [index, uploadedImage] of uploadedGallery.entries()) {
        uploadedPaths.push(...uploadedImage.uploadedPaths);
        const metadata = input.galleryImages[index];
        galleryImages.push({
          src: uploadedImage.displayUrl,
          storagePath: uploadedImage.displayPath,
          alt: metadata?.alt,
          label: metadata?.label
        });
      }
    }
  } catch (error) {
    await deleteArtifactImages(artifactId, uploadedPaths, session.token).catch(() => undefined);
    throw error;
  }

  return {
    coverImage,
    coverStoragePath,
    coverThumbnailImage,
    coverThumbnailStoragePath,
    galleryImages,
    uploadedPaths
  };
}

export async function createRemoteArtifact(
  input: ArtifactFormInput,
  existing: Artifact[],
  session: AdminSession,
  options: {
    sourceArtifactId?: string;
    volume?: string;
    palette?: Artifact["palette"];
    symbol?: string;
  } = {}
): Promise<ManagedArtifact> {
  const supabase = getSupabaseClient();
  const databaseId = remoteId();
  const displayId = options.sourceArtifactId ?? input.id ?? databaseId;
  const uploaded = await uploadInputImages(databaseId, input, session);
  const artifact = artifactFromInput(input, existing, displayId, "remote", {
    coverImage: uploaded.coverImage,
    coverStoragePath: uploaded.coverStoragePath,
    coverThumbnailImage: uploaded.coverThumbnailImage,
    coverThumbnailStoragePath: uploaded.coverThumbnailStoragePath,
    galleryImages: uploaded.galleryImages,
    remoteId: databaseId,
    sourceArtifactId: options.sourceArtifactId,
    volume: options.volume,
    palette: options.palette,
    symbol: options.symbol
  });

  try {
    const { data, error } = await supabase.rpc("create_museum_artifact", {
      input_session_token: session.token,
      artifact_row: rowFromArtifact(artifact)
    });

    if (error) throw new Error(error.message);
    return artifactFromRow(data as ArtifactRow);
  } catch (error) {
    await deleteArtifactImages(databaseId, uploaded.uploadedPaths, session.token).catch(() => undefined);
    throw error;
  }
}

export async function updateRemoteArtifact(
  id: string,
  input: ArtifactFormInput,
  existing: ManagedArtifact[],
  session: AdminSession
): Promise<ManagedArtifact> {
  const supabase = getSupabaseClient();
  const current = existing.find((artifact) => artifact.id === id);
  const databaseId = current?.remoteId ?? id;
  const uploaded = await uploadInputImages(databaseId, input, session);
  const artifact = artifactFromInput(input, existing, id, "remote", {
    coverImage: uploaded.coverImage,
    coverStoragePath: uploaded.coverStoragePath,
    coverThumbnailImage: uploaded.coverThumbnailImage,
    coverThumbnailStoragePath: uploaded.coverThumbnailStoragePath,
    galleryImages: uploaded.galleryImages,
    volume: current?.volume,
    remoteId: databaseId,
    sourceArtifactId: current?.sourceArtifactId,
    palette: current?.palette,
    symbol: current?.symbol
  });

  try {
    const { data, error } = await supabase.rpc("update_museum_artifact", {
      input_session_token: session.token,
      artifact_id: databaseId,
      artifact_row: rowFromArtifact(artifact)
    });

    if (error) throw new Error(error.message);
    const updated = artifactFromRow(data as ArtifactRow);
    const retainedPaths = new Set(artifactStoragePaths(updated));
    const replacedPaths = current ? artifactStoragePaths(current).filter((path) => !retainedPaths.has(path)) : [];
    await deleteArtifactImages(databaseId, replacedPaths, session.token).catch((cleanupError) => {
      console.warn("Artifact saved, but replaced images could not be removed", cleanupError);
    });
    return updated;
  } catch (error) {
    await deleteArtifactImages(databaseId, uploaded.uploadedPaths, session.token).catch(() => undefined);
    throw error;
  }
}

export async function deleteRemoteArtifact(id: string, session: AdminSession) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("trash_museum_artifact", {
    input_session_token: session.token,
    artifact_id: id
  });
  if (error) throw new Error(error.message);
}

export async function restoreRemoteArtifact(id: string, session: AdminSession) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("restore_museum_artifact", {
    input_session_token: session.token,
    artifact_id: id
  });
  if (error) throw new Error(error.message);
  return artifactFromRow(data as ArtifactRow);
}

export async function purgeRemoteArtifact(
  id: string,
  session: AdminSession,
  storagePaths: string[] = []
) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("purge_museum_artifact", {
    input_session_token: session.token,
    artifact_id: id
  });
  if (error) throw new Error(error.message);
  try {
    await deleteArtifactImages(id, storagePaths, session.token);
    return "";
  } catch (cleanupError) {
    console.warn("Artifact purged, but its images could not be removed", cleanupError);
    return "藏品已彻底删除，但旧图片清理失败，可稍后在 Storage 中清理";
  }
}

export async function batchUpdateRemoteArtifacts(
  ids: string[],
  patch: ArtifactBatchPatch,
  session: AdminSession
) {
  const { data, error } = await getSupabaseClient().rpc("batch_update_museum_artifacts", {
    input_session_token: session.token,
    input_artifact_ids: ids,
    input_patch: {
      ...patch,
      tags: patch.tags ? normalizeArtifactTags(patch.tags) : undefined
    }
  });
  if (error) throw new Error(error.message);
  return (data as ArtifactRow[]).map(artifactFromRow);
}

export async function loadArtifactVersions(id: string, session: AdminSession): Promise<ArtifactVersion[]> {
  const { data, error } = await getSupabaseClient().rpc("load_museum_artifact_versions", {
    input_session_token: session.token,
    input_artifact_id: id,
    input_limit: 30
  });
  if (error) throw new Error(error.message);
  return (data as Array<{
    id: number;
    artifact_id: string;
    operation: ArtifactVersion["operation"];
    snapshot: unknown;
    created_at: string;
  }>).map((row) => {
    const snapshot = isRecord(row.snapshot) ? row.snapshot : {};
    return {
      id: row.id,
      artifactId: row.artifact_id,
      operation: row.operation,
      title: typeof snapshot.title === "string" ? snapshot.title : "未命名藏品",
      visibility: normalizeVisibility(snapshot.visibility),
      createdAt: row.created_at
    };
  });
}

export async function restoreArtifactVersion(versionId: number, session: AdminSession) {
  const { data, error } = await getSupabaseClient().rpc("restore_museum_artifact_version", {
    input_session_token: session.token,
    input_version_id: versionId
  });
  if (error) throw new Error(error.message);
  return artifactFromRow(data as ArtifactRow);
}

export function queryArtifacts(
  artifacts: Artifact[],
  query: string,
  filter: "all" | ArtifactCategory,
  options: {
    tag?: string;
    year?: string;
    sort?: ArtifactSort;
  } = {}
): Artifact[] {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = artifacts.filter((artifact) => {
    const categoryMatches = filter === "all" || artifact.category === filter;
    if (!categoryMatches) return false;
    if (options.tag && !artifact.tags.some((tag) => tag === options.tag)) return false;
    if (options.year && artifact.artifactDate?.slice(0, 4) !== options.year && artifact.year !== options.year) {
      return false;
    }
    if (!normalizedQuery) return true;

    return [
      artifact.title,
      artifact.categoryLabel,
      ...artifact.tags,
      artifact.artifactDate ?? "",
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

  const originalOrder = new Map(artifacts.map((artifact, index) => [artifact.id, index]));
  const dateValue = (artifact: Artifact) => {
    const value = artifact.artifactDate ?? (artifact.year ? `${artifact.year}-01-01` : "");
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? 0 : timestamp;
  };
  const updatedValue = (artifact: Artifact) => {
    const timestamp = Date.parse(artifact.updatedAt ?? artifact.artifactDate ?? "");
    return Number.isNaN(timestamp) ? 0 : timestamp;
  };

  return [...filtered].sort((first, second) => {
    switch (options.sort ?? "catalog") {
      case "date-desc":
        return dateValue(second) - dateValue(first) || (originalOrder.get(first.id) ?? 0) - (originalOrder.get(second.id) ?? 0);
      case "date-asc": {
        const firstDate = dateValue(first);
        const secondDate = dateValue(second);
        if (!firstDate && secondDate) return 1;
        if (firstDate && !secondDate) return -1;
        return firstDate - secondDate || (originalOrder.get(first.id) ?? 0) - (originalOrder.get(second.id) ?? 0);
      }
      case "updated-desc":
        return updatedValue(second) - updatedValue(first) || (originalOrder.get(first.id) ?? 0) - (originalOrder.get(second.id) ?? 0);
      case "title-asc":
        return first.title.localeCompare(second.title, "zh-CN");
      default:
        return (originalOrder.get(first.id) ?? 0) - (originalOrder.get(second.id) ?? 0);
    }
  });
}
