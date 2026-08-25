import "server-only";
import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Service-role Supabase client. BYPASSES Row Level Security.
 * Server-only: used for admin writes, storage uploads, and auth admin ops.
 * Never import from a Client Component.
 */
export function createAdminClient(): SupabaseClient {
  if (!cached) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY server environment variable");
    }
    cached = createSupabaseClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cached;
}
