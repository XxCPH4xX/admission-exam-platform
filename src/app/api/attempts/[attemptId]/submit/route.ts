import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireUserApi } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { attemptIdParamSchema } from "@/validations/attempt";

/**
 * POST /api/attempts/:attemptId/submit
 * Manual or auto submission → atomic scoring RPC. Idempotent.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const auth = await requireUserApi();
  if (!auth.ok) return auth.response;

  const { attemptId } = await params;
  const parsedId = attemptIdParamSchema.safeParse(attemptId);
  if (!parsedId.success) {
    return NextResponse.json({ error: "INVALID_ATTEMPT_ID" }, { status: 400 });
  }

  const rl = rateLimit(`submit:${auth.user.id}`, 12, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "retry-after": String(rl.retryAfterSeconds) } }
    );
  }

  const db = createAdminClient();

  // Ownership check before invoking the definer-role RPC.
  const { data: owned } = await db
    .from("exam_attempts")
    .select("id, user_id")
    .eq("id", parsedId.data)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!owned) {
    return NextResponse.json({ error: "ATTEMPT_NOT_FOUND" }, { status: 404 });
  }

  // Was the deadline already past? Then this counts as an expiry submission.
  const { data: meta } = await db
    .from("exam_attempts")
    .select("ends_at")
    .eq("id", parsedId.data)
    .maybeSingle();
  const expired =
    Boolean(meta?.ends_at) && new Date(meta!.ends_at as string).getTime() <= Date.now();

  // p_user_id is required because the service-role JWT has no auth.uid();
  // the function still enforces ownership against it at the DB level.
  const { error } = await db.rpc("submit_attempt", {
    p_attempt_id: parsedId.data,
    p_user_id: auth.user.id,
  });

  if (error) {
    if (/AUTH_REQUIRED|FORBIDDEN/.test(error.message)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    return NextResponse.json({ error: "SUBMIT_FAILED" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    expired,
    resultUrl: `/student/result/${parsedId.data}`,
  });
}
