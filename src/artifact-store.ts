import { categories, type Artifact, type ArtifactCategory } from "./collection";

export const LOCAL_ARTIFACT_STORAGE_KEY = "mxren-museum.local-artifacts.v1";

export type GalleryImageInput = {
  src: string;
  alt?: string;
  label?: string;
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
  galleryImages: GalleryImageInput[];
  summary: string;
  note: string;
};

export type ManagedArtifact = Artifact & {
  source: "local";
  updatedAt: string;
};

type StoredArtifact = ManagedArtifact;

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
    value.source === "local"
  );
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

function volumeForLocalArtifact(existing: Artifact[]) {
  return `L${String(existing.length + 1).padStart(2, "0")}`;
}

function normalizeGalleryImages(input: ArtifactFormInput) {
  return input.galleryImages
    .filter((image) => normalizeText(image.src).length > 0)
    .slice(0, 3)
    .map((image, index) => ({
      src: normalizeText(image.src),
      alt: normalizeText(image.alt ?? "") || `${normalizeText(input.title)} 的详情图片 ${index + 1}`,
      label: normalizeText(image.label ?? "") || defaultGalleryLabels[index] || `图 ${index + 1}`
    }));
}

function artifactFromInput(input: ArtifactFormInput, existing: Artifact[], id: string): ManagedArtifact {
  const title = normalizeText(input.title);
  const category = input.category;
  const now = new Date().toISOString();

  return {
    id,
    title,
    category,
    categoryLabel: categoryLabel(category),
    volume: volumeForLocalArtifact(existing),
    year: normalizeText(input.year) || String(new Date().getFullYear()),
    medium: normalizeText(input.medium) || "Digital Artifact",
    rarity: normalizeText(input.rarity) || "本地馆藏",
    featured: input.featured,
    symbol: symbolByCategory[category],
    coverAlt: normalizeText(input.coverAlt ?? "") || `${title} 的藏品封面`,
    coverImage: normalizeText(input.coverImage ?? ""),
    galleryImages: normalizeGalleryImages(input),
    palette: defaultPaletteByCategory[category],
    summary: normalizeText(input.summary),
    note: normalizeText(input.note),
    source: "local",
    updatedAt: now
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
    return parsed.filter(isManagedArtifact);
  } catch {
    return [];
  }
}

export function saveLocalArtifacts(artifacts: ManagedArtifact[], storage?: Storage) {
  const target = getStorage(storage);
  if (!target) return;
  const stored: StoredArtifact[] = artifacts.map((artifact) => ({ ...artifact, source: "local" }));
  target.setItem(LOCAL_ARTIFACT_STORAGE_KEY, JSON.stringify(stored));
}

export function createLocalArtifact(input: ArtifactFormInput, existing: Artifact[]): ManagedArtifact {
  return artifactFromInput(input, existing, uniqueId(input.title, existing));
}

export function updateLocalArtifact(
  id: string,
  input: ArtifactFormInput,
  existing: ManagedArtifact[]
): ManagedArtifact[] {
  return existing.map((artifact) => {
    if (artifact.id !== id) return artifact;
    return {
      ...artifactFromInput(input, existing, id),
      volume: artifact.volume
    };
  });
}

export function deleteLocalArtifact(id: string, existing: ManagedArtifact[]): ManagedArtifact[] {
  return existing.filter((artifact) => artifact.id !== id);
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
