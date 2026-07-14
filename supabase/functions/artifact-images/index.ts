import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const bucket = "artifact-images";
const allowedOrigins = new Set([
  "https://mrx-data.github.io",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:4174",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://localhost:4174",
  "http://localhost:5173"
]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && allowedOrigins.has(origin) ? origin : "https://mrx-data.github.io";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-museum-session",
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
    Vary: "Origin"
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" }
  });
}

function elevatedApiKey() {
  const serializedSecretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (serializedSecretKeys) {
    try {
      const secretKeys = JSON.parse(serializedSecretKeys) as Record<string, string>;
      const secretKey = secretKeys.default ?? Object.values(secretKeys)[0];
      if (secretKey) return secretKey;
    } catch {
      // Fall through for projects that have not enabled the new key model yet.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (origin && !allowedOrigins.has(origin)) return json({ error: "Origin not allowed" }, 403, origin);

  const sessionToken = request.headers.get("X-Museum-Session")?.trim();
  if (!sessionToken) return json({ error: "Museum admin session required" }, 401, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = elevatedApiKey();
  if (!supabaseUrl || !secretKey) return json({ error: "Storage service is not configured" }, 500, origin);
  const supabase = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
  const { data: validSession, error: sessionError } = await supabase.rpc("verify_museum_admin_session", {
    input_session_token: sessionToken
  });
  if (sessionError || !validSession) return json({ error: "Invalid or expired museum admin session" }, 401, origin);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, origin);
  }
  const artifactId = typeof body.artifactId === "string" ? body.artifactId : "";
  if (!uuidPattern.test(artifactId)) return json({ error: "Invalid artifact id" }, 400, origin);

  if (request.method === "POST") {
    const assets = Array.isArray(body.assets) ? body.assets : [];
    if (assets.length === 0 || assets.length > 8) return json({ error: "Between 1 and 8 assets are required" }, 400, origin);
    const paths: string[] = [];
    for (const value of assets) {
      if (!value || typeof value !== "object") return json({ error: "Invalid asset" }, 400, origin);
      const asset = value as Record<string, unknown>;
      const assetId = typeof asset.assetId === "string" ? asset.assetId : "";
      const variant = asset.variant === "display" || asset.variant === "thumbnail" ? asset.variant : "";
      const extension = asset.extension === "webp" || asset.extension === "jpg" || asset.extension === "gif" ? asset.extension : "";
      const contentType =
        asset.contentType === "image/webp" || asset.contentType === "image/jpeg" || asset.contentType === "image/gif"
          ? asset.contentType
          : "";
      if (!uuidPattern.test(assetId) || !variant || !extension || !contentType) {
        return json({ error: "Invalid asset metadata" }, 400, origin);
      }
      const typeMatchesExtension =
        (extension === "webp" && contentType === "image/webp") ||
        (extension === "jpg" && contentType === "image/jpeg") ||
        (extension === "gif" && contentType === "image/gif");
      if (!typeMatchesExtension || (variant === "thumbnail" && extension === "gif")) {
        return json({ error: "Asset type does not match its variant" }, 400, origin);
      }
      paths.push(`artifacts/${artifactId}/${assetId}/${variant}.${extension}`);
    }

    const uploads = [];
    for (const path of paths) {
      const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
      if (error) return json({ error: error.message }, 500, origin);
      uploads.push({ path, token: data.token });
    }
    return json({ uploads }, 200, origin);
  }

  if (request.method === "DELETE") {
    const paths = Array.isArray(body.paths) ? body.paths.filter((path): path is string => typeof path === "string") : [];
    if (paths.length > 16) return json({ error: "Too many paths" }, 400, origin);
    const prefix = `artifacts/${artifactId}/`;
    if (paths.some((path) => !path.startsWith(prefix) || path.includes(".."))) {
      return json({ error: "Storage path does not belong to this artifact" }, 403, origin);
    }
    if (paths.length > 0) {
      const { error } = await supabase.storage.from(bucket).remove([...new Set(paths)]);
      if (error) return json({ error: error.message }, 500, origin);
    }
    return json({ deleted: [...new Set(paths)] }, 200, origin);
  }

  return json({ error: "Method not allowed" }, 405, origin);
});
