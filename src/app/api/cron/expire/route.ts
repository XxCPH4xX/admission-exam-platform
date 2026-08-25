import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/cron/expire — called by Vercel Cron every minute.
 * Finalizes attempts whose deadline passed (scores + status flip) even when
 * no student request triggers the lazy path.
 *
 * Protected by the CRON_SECRET env var (Vercel sends it as a Bearer token).
 * Set CRON_SECRET in Vercel project settings; locally any value works.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
  }

  const { data, error } = await createAdminClient().rpc(
    "expire_all_stale_attempts"
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ finalized: data ?? 0 });
}
