import type { Artifact, ArtifactVisibility } from "./collection";
import type { AdminSession, ArtifactCategoryDefinition } from "./artifact-store";
import type { MuseumExhibition } from "./exhibition-store";
import { MUSEUM_EXPORT_FORMAT } from "./museum-export";
import { getSupabaseClient } from "./supabase-client";

export type MuseumImportStrategy = "skip" | "overwrite";

export type MuseumImportArtifact = {
  id: string;
  remoteId: string | null;
  sourceArtifactId: string | null;
  title: string;
  category: string;
  categoryLabel: string;
  tags: string[];
  artifactDate: string | null;
  volume: string;
  year: string;
  medium: string;
  rarity: string;
  featured: boolean;
  visibility: ArtifactVisibility;
  symbol: string;
  coverAlt: string;
  coverImage: string;
  coverStoragePath: string | null;
  coverThumbnailImage: string;
  coverThumbnailStoragePath: string | null;
  galleryImages: Array<{
    src: string;
    storagePath: string | null;
    alt: string;
    label: string;
  }>;
  palette: Artifact["palette"];
  summary: string;
  note: string;
  createdAt: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type MuseumImportPayload = {
  format: typeof MUSEUM_EXPORT_FORMAT;
  exportedAt: string;
  counts: {
    artifacts: number;
    trash: number;
    categories: number;
    exhibitions: number;
  };
  categories: ArtifactCategoryDefinition[];
  exhibitions: MuseumExhibition[];
  artifacts: MuseumImportArtifact[];
  trash: MuseumImportArtifact[];
};

export type MuseumImportPreview = {
  payload: MuseumImportPayload;
  sourceDate: string;
  creates: number;
  updates: number;
  unchanged: number;
  builtInOnly: number;
  trashCreates: number;
  trashUpdates: number;
  categoryChanges: number;
  exhibitionChanges: number;
  missingArtifactReferences: Array<{ exhibitionTitle: string; artifactId: string }>;
  warnings: string[];
};

export type MuseumImportResult = {
  dryRun: boolean;
  strategy: MuseumImportStrategy;
  created: number;
  updated: number;
  skipped: number;
  trashed: number;
  categories: number;
  exhibitions: number;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const exhibitionIdPattern = /^[a-z0-9][a-z0-9-]{2,63}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const maxImportBytes = 8 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string, maxLength: number) {
  const value = record[key];
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new Error(`字段 ${key} 格式无效`);
  }
  return value.trim();
}

function optionalString(record: Record<string, unknown>, key: string, maxLength: number) {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.length > maxLength) throw new Error(`字段 ${key} 格式无效`);
  return value.trim() || null;
}

function safeImageSource(value: unknown, key: string) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string" || value.length > 2048 || /^data:/i.test(value.trim())) {
    throw new Error(`${key} 不能包含 Base64 或超长图片地址`);
  }
  return value.trim();
}

function boundedText(value: unknown, key: string, maxLength: number) {
  if (typeof value !== "string" || value.length > maxLength) throw new Error(`${key} 格式无效`);
  return value.trim();
}

function storagePath(value: unknown, key: string, remoteId: string | null) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 512 || !remoteId || !value.startsWith(`artifacts/${remoteId}/`)) {
    throw new Error(`${key} 不属于当前藏品目录`);
  }
  return value;
}

function visibility(value: unknown): ArtifactVisibility {
  if (value === "draft" || value === "published" || value === "unlisted") return value;
  throw new Error("陈列状态无效");
}

function palette(value: unknown): Artifact["palette"] {
  if (!isRecord(value)) throw new Error("palette 格式无效");
  return {
    from: requiredString(value, "from", 32),
    via: requiredString(value, "via", 32),
    to: requiredString(value, "to", 32),
    accent: requiredString(value, "accent", 32)
  };
}

function artifactRecord(value: unknown, location: string): MuseumImportArtifact {
  if (!isRecord(value)) throw new Error(`${location} 不是有效的藏品记录`);
  const id = requiredString(value, "id", 128);
  const remoteId = optionalString(value, "remoteId", 64);
  if (remoteId && !uuidPattern.test(remoteId)) throw new Error(`${location}.remoteId 不是有效 UUID`);
  const sourceArtifactId = optionalString(value, "sourceArtifactId", 128);
  const tags = Array.isArray(value.tags)
    ? value.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean)
    : [];
  if (tags.length > 12 || tags.some((tag) => tag.length > 24)) throw new Error(`${location}.tags 超出限制`);
  const artifactDate = optionalString(value, "artifactDate", 10);
  if (artifactDate && !datePattern.test(artifactDate)) throw new Error(`${location}.artifactDate 格式无效`);
  const galleries = Array.isArray(value.galleryImages) ? value.galleryImages : [];
  if (galleries.length > 3) throw new Error(`${location}.galleryImages 最多三张`);
  if (typeof value.featured !== "boolean") throw new Error(`${location}.featured 必须为布尔值`);

  return {
    id,
    remoteId,
    sourceArtifactId,
    title: requiredString(value, "title", 120),
    category: requiredString(value, "category", 64),
    categoryLabel: requiredString(value, "categoryLabel", 80),
    tags,
    artifactDate,
    volume: requiredString(value, "volume", 32),
    year: requiredString(value, "year", 32),
    medium: requiredString(value, "medium", 120),
    rarity: requiredString(value, "rarity", 120),
    featured: value.featured,
    visibility: visibility(value.visibility),
    symbol: typeof value.symbol === "string" ? value.symbol.slice(0, 24) : "",
    coverAlt: requiredString(value, "coverAlt", 240),
    coverImage: safeImageSource(value.coverImage, `${location}.coverImage`),
    coverStoragePath: storagePath(value.coverStoragePath, `${location}.coverStoragePath`, remoteId),
    coverThumbnailImage: safeImageSource(value.coverThumbnailImage, `${location}.coverThumbnailImage`),
    coverThumbnailStoragePath: storagePath(
      value.coverThumbnailStoragePath,
      `${location}.coverThumbnailStoragePath`,
      remoteId
    ),
    galleryImages: galleries.map((gallery, index) => {
      if (!isRecord(gallery)) throw new Error(`${location}.galleryImages[${index}] 格式无效`);
      return {
        src: safeImageSource(gallery.src, `${location}.galleryImages[${index}].src`),
        storagePath: storagePath(
          gallery.storagePath,
          `${location}.galleryImages[${index}].storagePath`,
          remoteId
        ),
        alt: requiredString(gallery, "alt", 240),
        label: requiredString(gallery, "label", 80)
      };
    }),
    palette: palette(value.palette),
    summary: boundedText(value.summary, `${location}.summary`, 4000),
    note: boundedText(value.note, `${location}.note`, 12000),
    createdAt: optionalString(value, "createdAt", 40),
    updatedAt: optionalString(value, "updatedAt", 40),
    deletedAt: optionalString(value, "deletedAt", 40)
  };
}

function categoryRecord(value: unknown, index: number): ArtifactCategoryDefinition {
  if (!isRecord(value)) throw new Error(`categories[${index}] 格式无效`);
  return {
    id: requiredString(value, "id", 64),
    label: requiredString(value, "label", 40)
  };
}

function exhibitionRecord(value: unknown, index: number): MuseumExhibition {
  if (!isRecord(value)) throw new Error(`exhibitions[${index}] 格式无效`);
  const id = requiredString(value, "id", 64);
  if (!exhibitionIdPattern.test(id)) throw new Error(`exhibitions[${index}].id 格式无效`);
  const artifactIds = Array.isArray(value.artifactIds)
    ? value.artifactIds.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
  if (artifactIds.length < 1 || artifactIds.length > 50) throw new Error(`exhibitions[${index}] 藏品数量无效`);
  return {
    id,
    title: requiredString(value, "title", 80),
    summary: typeof value.summary === "string" ? value.summary.trim().slice(0, 280) : "",
    note: typeof value.note === "string" ? value.note.trim().slice(0, 4000) : "",
    visibility: visibility(value.visibility),
    artifactIds: [...new Set(artifactIds)],
    createdAt: optionalString(value, "createdAt", 40) ?? undefined,
    updatedAt: optionalString(value, "updatedAt", 40) ?? undefined
  };
}

function stableArtifactValue(artifact: MuseumImportArtifact | Artifact) {
  return JSON.stringify({
    title: artifact.title,
    category: artifact.category,
    categoryLabel: artifact.categoryLabel,
    tags: artifact.tags,
    artifactDate: artifact.artifactDate ?? null,
    year: artifact.year,
    medium: artifact.medium,
    rarity: artifact.rarity,
    featured: artifact.featured,
    visibility: artifact.visibility,
    coverStoragePath: artifact.coverStoragePath ?? null,
    coverThumbnailStoragePath: artifact.coverThumbnailStoragePath ?? null,
    galleryImages: artifact.galleryImages.map((image) => ({ storagePath: image.storagePath ?? null, src: image.src })),
    summary: artifact.summary,
    note: artifact.note
  });
}

function importKey(artifact: MuseumImportArtifact) {
  return artifact.remoteId ?? (artifact.sourceArtifactId ? `source:${artifact.sourceArtifactId}` : `builtin:${artifact.id}`);
}

function currentKey(artifact: Artifact) {
  return artifact.remoteId ?? (artifact.sourceArtifactId ? `source:${artifact.sourceArtifactId}` : `builtin:${artifact.id}`);
}

export function parseMuseumImportText(text: string): MuseumImportPayload {
  if (new Blob([text]).size > maxImportBytes) throw new Error("导入文件超过 8MB 限制");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("无法解析 JSON，请确认文件未损坏");
  }
  if (!isRecord(raw) || raw.format !== MUSEUM_EXPORT_FORMAT) {
    throw new Error(`仅支持 ${MUSEUM_EXPORT_FORMAT} 格式`);
  }
  const exportedAt = requiredString(raw, "exportedAt", 40);
  if (Number.isNaN(Date.parse(exportedAt))) throw new Error("导出时间格式无效");
  const categories = Array.isArray(raw.categories) ? raw.categories.map(categoryRecord) : [];
  const exhibitions = Array.isArray(raw.exhibitions) ? raw.exhibitions.map(exhibitionRecord) : [];
  const artifacts = Array.isArray(raw.artifacts)
    ? raw.artifacts.map((item, index) => artifactRecord(item, `artifacts[${index}]`))
    : [];
  const trash = Array.isArray(raw.trash) ? raw.trash.map((item, index) => artifactRecord(item, `trash[${index}]`)) : [];
  if (artifacts.length > 5000 || trash.length > 5000 || categories.length > 500 || exhibitions.length > 500) {
    throw new Error("导入记录数量超出安全限制");
  }
  if (new Set(categories.map((category) => category.id)).size !== categories.length) {
    throw new Error("导入文件包含重复的类别标识");
  }
  if (new Set(exhibitions.map((exhibition) => exhibition.id)).size !== exhibitions.length) {
    throw new Error("导入文件包含重复的专题标识");
  }
  const keys = [...artifacts, ...trash].map(importKey).filter((key) => !key.startsWith("builtin:"));
  if (new Set(keys).size !== keys.length) throw new Error("导入文件包含重复的云端藏品标识");

  return {
    format: MUSEUM_EXPORT_FORMAT,
    exportedAt,
    counts: {
      artifacts: artifacts.length,
      trash: trash.length,
      categories: categories.length,
      exhibitions: exhibitions.length
    },
    categories,
    exhibitions,
    artifacts,
    trash
  };
}

export function createMuseumImportPreview(
  payload: MuseumImportPayload,
  currentArtifacts: Artifact[],
  currentTrash: Artifact[],
  currentCategories: ArtifactCategoryDefinition[],
  currentExhibitions: MuseumExhibition[]
): MuseumImportPreview {
  const current = new Map([...currentArtifacts, ...currentTrash].map((artifact) => [currentKey(artifact), artifact]));
  let creates = 0;
  let updates = 0;
  let unchanged = 0;
  let builtInOnly = 0;
  let trashCreates = 0;
  let trashUpdates = 0;
  payload.artifacts.forEach((artifact) => {
    if (!artifact.remoteId) {
      builtInOnly += 1;
      return;
    }
    const existing = current.get(importKey(artifact));
    if (!existing) creates += 1;
    else if (stableArtifactValue(existing) === stableArtifactValue(artifact) && !existing.deletedAt) unchanged += 1;
    else updates += 1;
  });
  payload.trash.forEach((artifact) => {
    if (!artifact.remoteId) return;
    const existing = current.get(importKey(artifact));
    if (!existing) trashCreates += 1;
    else if (!existing.deletedAt || stableArtifactValue(existing) !== stableArtifactValue(artifact)) trashUpdates += 1;
    else unchanged += 1;
  });
  const knownIds = new Set(payload.artifacts.map((artifact) => artifact.id));
  currentArtifacts.forEach((artifact) => knownIds.add(artifact.id));
  const missingArtifactReferences = payload.exhibitions.flatMap((exhibition) =>
    exhibition.artifactIds
      .filter((artifactId) => !knownIds.has(artifactId))
      .map((artifactId) => ({ exhibitionTitle: exhibition.title, artifactId }))
  );
  const currentCategoryMap = new Map(currentCategories.map((category) => [category.id, category.label]));
  const currentExhibitionMap = new Map(currentExhibitions.map((item) => [item.id, JSON.stringify(item)]));
  const warnings: string[] = [];
  if (builtInOnly) warnings.push(`${builtInOnly} 条内置藏品记录不写入数据库，只用于引用校验`);
  if (missingArtifactReferences.length) warnings.push(`${missingArtifactReferences.length} 个专题引用在当前馆藏中不存在`);
  const legacyImages = [...payload.artifacts, ...payload.trash].filter(
    (artifact) => !artifact.coverStoragePath && Boolean(artifact.coverImage)
  ).length;
  if (legacyImages) warnings.push(`${legacyImages} 件藏品仅含外部图片地址，恢复后可显示但不受 Storage 路径保护`);

  return {
    payload,
    sourceDate: payload.exportedAt,
    creates,
    updates,
    unchanged,
    builtInOnly,
    trashCreates,
    trashUpdates,
    categoryChanges: payload.categories.filter((category) => currentCategoryMap.get(category.id) !== category.label).length,
    exhibitionChanges: payload.exhibitions.filter(
      (exhibition) => currentExhibitionMap.get(exhibition.id) !== JSON.stringify(exhibition)
    ).length,
    missingArtifactReferences,
    warnings
  };
}

export async function applyMuseumImport(
  payload: MuseumImportPayload,
  strategy: MuseumImportStrategy,
  session: AdminSession,
  dryRun: boolean
): Promise<MuseumImportResult> {
  const { data, error } = await getSupabaseClient().rpc("apply_museum_import", {
    input_session_token: session.token,
    import_payload: payload,
    conflict_strategy: strategy,
    input_dry_run: dryRun
  });
  if (error) throw new Error(error.message);
  if (!isRecord(data)) throw new Error("导入服务返回了无效结果");
  return {
    dryRun: Boolean(data.dryRun),
    strategy,
    created: Number(data.created ?? 0),
    updated: Number(data.updated ?? 0),
    skipped: Number(data.skipped ?? 0),
    trashed: Number(data.trashed ?? 0),
    categories: Number(data.categories ?? 0),
    exhibitions: Number(data.exhibitions ?? 0)
  };
}
