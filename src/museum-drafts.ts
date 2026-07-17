import type { ArtifactVisibility } from "./collection";
import type { GalleryImageInput } from "./artifact-store";

export const MUSEUM_DRAFT_STORAGE_KEY = "mxren-museum.management-drafts.v1";

export type ArtifactDraft = {
  savedAt: string;
  editingArtifactId: string | null;
  title: string;
  category: string;
  year: string;
  artifactDate: string;
  tags: string;
  medium: string;
  rarity: string;
  summary: string;
  note: string;
  featured: boolean;
  visibility: ArtifactVisibility;
  coverImage: string;
  coverStoragePath?: string;
  coverThumbnailImage?: string;
  coverThumbnailStoragePath?: string;
  galleryImages: GalleryImageInput[];
  hadLocalFiles: boolean;
};

export type ExhibitionDraft = {
  savedAt: string;
  editingExhibitionId: string | null;
  id: string;
  title: string;
  summary: string;
  note: string;
  visibility: ArtifactVisibility;
  artifactIds: string[];
};

export type MuseumDraftBundle = {
  artifact?: ArtifactDraft;
  exhibition?: ExhibitionDraft;
};

function storageTarget(storage?: Storage) {
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

function isArtifactDraft(value: unknown): value is ArtifactDraft {
  return isRecord(value) && typeof value.savedAt === "string" && typeof value.title === "string";
}

function isExhibitionDraft(value: unknown): value is ExhibitionDraft {
  return isRecord(value) && typeof value.savedAt === "string" && typeof value.title === "string";
}

export function loadMuseumDrafts(storage?: Storage): MuseumDraftBundle {
  const target = storageTarget(storage);
  if (!target) return {};
  try {
    const raw = target.getItem(MUSEUM_DRAFT_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    return {
      artifact: isArtifactDraft(parsed.artifact) ? parsed.artifact : undefined,
      exhibition: isExhibitionDraft(parsed.exhibition) ? parsed.exhibition : undefined
    };
  } catch {
    return {};
  }
}

export function saveMuseumDrafts(bundle: MuseumDraftBundle, storage?: Storage) {
  const target = storageTarget(storage);
  if (!target) return;
  if (!bundle.artifact && !bundle.exhibition) {
    target.removeItem(MUSEUM_DRAFT_STORAGE_KEY);
    return;
  }
  target.setItem(MUSEUM_DRAFT_STORAGE_KEY, JSON.stringify(bundle));
}

export function updateMuseumDrafts(update: Partial<MuseumDraftBundle>, storage?: Storage) {
  const bundle = { ...loadMuseumDrafts(storage), ...update };
  saveMuseumDrafts(bundle, storage);
  return bundle;
}

export function clearArtifactDraft(storage?: Storage) {
  const bundle = loadMuseumDrafts(storage);
  delete bundle.artifact;
  saveMuseumDrafts(bundle, storage);
}

export function clearExhibitionDraft(storage?: Storage) {
  const bundle = loadMuseumDrafts(storage);
  delete bundle.exhibition;
  saveMuseumDrafts(bundle, storage);
}
