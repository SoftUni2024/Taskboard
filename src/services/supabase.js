import { createClient } from "@supabase/supabase-js";

// Publishable client configuration. RLS protects every application table.
// Never put a secret/service-role key in this module or any VITE_* variable.
export const SUPABASE_URL = "https://jnehjelpwqqqeldsbeag.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_4Id5ZtV2dNGZTlrDB5tGqw_BCruvDpi";
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
