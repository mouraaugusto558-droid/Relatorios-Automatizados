import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../../config/env";

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
      throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados");
    }
    client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false }
    });
  }
  return client;
}
