/**
 * Finalizes any attempts whose deadline has passed (scores them, flips status).
 * Designed for Vercel Cron / GitHub Actions every minute; also safe to run manually.
 *
 * Usage:  npm run db:expire
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // env may already be set
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { data, error } = await admin.rpc("expire_all_stale_attempts");
if (error) {
  console.error("✗", error.message);
  process.exit(1);
}
console.log(`✓ finalized ${data ?? 0} stale attempt(s)`);
