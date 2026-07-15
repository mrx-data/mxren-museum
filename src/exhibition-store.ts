import type { ArtifactVisibility } from "./collection";
import type { AdminSession } from "./artifact-store";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client";

export const LOCAL_EXHIBITION_STORAGE_KEY = "mxren-museum.local-exhibitions.v1";

export type MuseumExhibition = {
  id: string;
  title: string;
  summary: string;
  note: string;
  visibility: ArtifactVisibility;
  artifactIds: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type ExhibitionFormInput = Pick<
  MuseumExhibition,
  "id" | "title" | "summary" | "note" | "visibility" | "artifactIds"
>;

type ExhibitionRow = {
  id: string;
  title: string;
  summary: string | null;
  note: string | null;
  visibility: string | null;
  artifact_ids: unknown;
  created_at?: string | null;
  updated_at?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeVisibility(value: unknown): ArtifactVisibility {
  return value === "draft" || value === "unlisted" ? value : "published";
}

export function normalizeExhibitionId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function normalizeExhibitionArtifactIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    })
    .slice(0, 50);
}

function exhibitionFromRow(row: ExhibitionRow): MuseumExhibition {
  return {
    id: row.id,
    title: row.title.trim() || "未命名专题",
    summary: row.summary?.trim() ?? "",
    note: row.note?.trim() ?? "",
    visibility: normalizeVisibility(row.visibility),
    artifactIds: normalizeExhibitionArtifactIds(row.artifact_ids),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

function rowFromExhibition(input: ExhibitionFormInput) {
  return {
    id: normalizeExhibitionId(input.id || input.title),
    title: input.title.trim(),
    summary: input.summary.trim(),
    note: input.note.trim(),
    visibility: normalizeVisibility(input.visibility),
    artifact_ids: normalizeExhibitionArtifactIds(input.artifactIds)
  };
}

export function loadLocalExhibitions(storage: Storage = globalThis.localStorage): MuseumExhibition[] {
  try {
    const raw = storage.getItem(LOCAL_EXHIBITION_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecord).map((item) =>
      exhibitionFromRow({
        id: typeof item.id === "string" ? item.id : "",
        title: typeof item.title === "string" ? item.title : "",
        summary: typeof item.summary === "string" ? item.summary : "",
        note: typeof item.note === "string" ? item.note : "",
        visibility: typeof item.visibility === "string" ? item.visibility : "published",
        artifact_ids: item.artifactIds,
        created_at: typeof item.createdAt === "string" ? item.createdAt : null,
        updated_at: typeof item.updatedAt === "string" ? item.updatedAt : null
      })
    );
  } catch {
    return [];
  }
}

export async function loadMuseumExhibitions(session: AdminSession | null = null) {
  if (!isSupabaseConfigured()) return loadLocalExhibitions();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("load_museum_exhibitions", {
    input_session_token: session?.token ?? null
  });
  if (error) return loadLocalExhibitions();
  return (data as ExhibitionRow[]).map(exhibitionFromRow);
}

export async function loadMuseumExhibitionById(id: string, session: AdminSession | null = null) {
  if (!isSupabaseConfigured()) {
    return loadLocalExhibitions().find((exhibition) => exhibition.id === id) ?? null;
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("load_museum_exhibition", {
    input_exhibition_id: id,
    input_session_token: session?.token ?? null
  });
  if (error) throw new Error(error.message);
  const row = (data as ExhibitionRow[])[0];
  return row ? exhibitionFromRow(row) : null;
}

export async function saveMuseumExhibition(input: ExhibitionFormInput, session: AdminSession) {
  const row = rowFromExhibition(input);
  if (!row.id) throw new Error("请填写专题标识");
  if (!row.title) throw new Error("请填写专题标题");
  if (row.artifact_ids.length === 0) throw new Error("请至少选择一件藏品");

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("save_museum_exhibition", {
    input_session_token: session.token,
    exhibition_row: row
  });
  if (error) throw new Error(error.message);
  return exhibitionFromRow(data as ExhibitionRow);
}

export async function deleteMuseumExhibition(id: string, session: AdminSession) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("delete_museum_exhibition", {
    input_session_token: session.token,
    input_exhibition_id: id
  });
  if (error) throw new Error(error.message);
}
