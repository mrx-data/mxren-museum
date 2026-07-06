import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type ViteImportMeta = ImportMeta & {
  env?: Record<string, string | undefined>;
};

const env = (import.meta as ViteImportMeta).env ?? {};

const defaultSupabaseUrl = "https://wjhktoqihszgdkxbanxu.supabase.co";
const defaultSupabasePublishableKey = "sb_publishable_2EMvcXdLaZ3owlJxz9xtVA_OL9ibHv8";

export const SUPABASE_ARTIFACT_BUCKET = "artifact-images";

export const supabaseUrl = (env.VITE_SUPABASE_URL ?? defaultSupabaseUrl).trim();
export const supabasePublishableKey = (
  env.VITE_SUPABASE_PUBLISHABLE_KEY ?? defaultSupabasePublishableKey
).trim();

export function isSupabaseConfigured() {
  return supabaseUrl.startsWith("https://") && supabasePublishableKey.startsWith("sb_publishable_");
}

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}
