import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/api-auth";
import { getAttemptSession } from "@/services/attempts.service";
import { attemptIdParamSchema } from "@/validations/attempt";

/**
 * GET /api/attempts/:attemptId/session
 * Full engine state for (re)hydration: questions without correct answers,
 * saved answers and the server-authoritative remaining time.
 */
export async function GET(
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

  // Finalize any of this student's expired attempts first.
  await createAdminRpcExpire();

  const session = await getAttemptSession(auth.user.id, parsedId.data);
  if (!session) {
    return NextResponse.json(
      { error: "ATTEMPT_NOT_ACTIVE" },
      { status: 404 }
    );
  }

  return NextResponse.json(session);
}

async function createAdminRpcExpire() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  await createAdminClient().rpc("expire_all_stale_attempts");
}
