import type { Artifact } from "./collection";
import type { ArtifactCategoryDefinition } from "./artifact-store";
import type { MuseumExhibition } from "./exhibition-store";

export const MUSEUM_EXPORT_FORMAT = "mxren-museum.export.v1";

function safeImageReference(src: string) {
  return /^data:/i.test(src.trim()) ? "" : src.trim();
}

function artifactExportRecord(artifact: Artifact) {
  return {
    id: artifact.id,
    remoteId: artifact.remoteId ?? null,
    sourceArtifactId: artifact.sourceArtifactId ?? null,
    title: artifact.title,
    category: artifact.category,
    categoryLabel: artifact.categoryLabel,
    tags: [...artifact.tags],
    artifactDate: artifact.artifactDate ?? null,
    volume: artifact.volume,
    year: artifact.year,
    medium: artifact.medium,
    rarity: artifact.rarity,
    featured: artifact.featured,
    visibility: artifact.visibility,
    symbol: artifact.symbol,
    coverAlt: artifact.coverAlt,
    coverImage: safeImageReference(artifact.coverImage),
    coverStoragePath: artifact.coverStoragePath ?? null,
    coverThumbnailImage: safeImageReference(artifact.coverThumbnailImage ?? ""),
    coverThumbnailStoragePath: artifact.coverThumbnailStoragePath ?? null,
    galleryImages: artifact.galleryImages.map((image) => ({
      src: safeImageReference(image.src),
      storagePath: image.storagePath ?? null,
      alt: image.alt,
      label: image.label
    })),
    palette: { ...artifact.palette },
    summary: artifact.summary,
    note: artifact.note,
    createdAt: artifact.createdAt ?? null,
    updatedAt: artifact.updatedAt ?? null,
    deletedAt: artifact.deletedAt ?? null
  };
}

export function createMuseumExport(
  artifacts: Artifact[],
  trash: Artifact[],
  categories: ArtifactCategoryDefinition[],
  exhibitions: MuseumExhibition[]
) {
  return {
    format: MUSEUM_EXPORT_FORMAT,
    exportedAt: new Date().toISOString(),
    counts: {
      artifacts: artifacts.length,
      trash: trash.length,
      categories: categories.length,
      exhibitions: exhibitions.length
    },
    categories: categories.map((category) => ({ ...category })),
    exhibitions: exhibitions.map((exhibition) => ({
      id: exhibition.id,
      title: exhibition.title,
      summary: exhibition.summary,
      note: exhibition.note,
      visibility: exhibition.visibility,
      artifactIds: [...exhibition.artifactIds],
      createdAt: exhibition.createdAt ?? null,
      updatedAt: exhibition.updatedAt ?? null
    })),
    artifacts: artifacts.map(artifactExportRecord),
    trash: trash.map(artifactExportRecord)
  };
}

export function downloadMuseumExport(payload: ReturnType<typeof createMuseumExport>) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mxren-museum-${payload.exportedAt.slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
