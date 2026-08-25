import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireUserApi } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveAnswerSchema, attemptIdParamSchema } from "@/validations/attempt";

/**
 * PUT /api/attempts/:attemptId/answers
 * Autosave endpoint. Server validates ownership + active status; if the
 * deadline has passed it finalizes the attempt instead of saving.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const auth = await requireUserApi();
  if (!auth.ok) return auth.response;

  const { attemptId } = await params;
  const parsedId = attemptIdParamSchema.safeParse(attemptId);
  if (!parsedId.success) {
    return NextResponse.json({ error: "INVALID_ATTEMPT_ID" }, { status: 400 });
  }

  // Autosave is high-frequency: generous but bounded per student.
  const rl = rateLimit(`answers:${auth.user.id}`, 240, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "retry-after": String(rl.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsedBody = saveAnswerSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED" },
      { status: 422 }
    );
  }
  const { questionId, selectedAnswer } = parsedBody.data;

  const db = createAdminClient();

  // Ownership + liveness check in one query.
  const { data: attempt } = await db
    .from("exam_attempts")
    .select("id, user_id, status, ends_at")
    .eq("id", parsedId.data)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  type AttemptLite = {
    id: string;
    user_id: string;
    status: string;
    ends_at: string;
  };
  const row = attempt as unknown as AttemptLite | null;

  if (!row) {
    return NextResponse.json({ error: "ATTEMPT_NOT_FOUND" }, { status: 404 });
  }

  if (row.status !== "in_progress") {
    return NextResponse.json(
      { error: "ATTEMPT_NOT_ACTIVE", status: row.status },
      { status: 409 }
    );
  }

  const expired = new Date(row.ends_at).getTime() <= Date.now();
  if (expired) {
    // Timer exploit guard: deadline passed → finalize, reject the save.
    await db.rpc("expire_all_stale_attempts");
    return NextResponse.json(
      { error: "ATTEMPT_EXPIRED", submitted: true },
      { status: 409 }
    );
  }

  const nowIso = new Date().toISOString();
  const { error: upsertError } = await db.from("answers").upsert(
    {
      attempt_id: row.id,
      question_id: questionId,
      selected_answer: selectedAnswer,
      updated_at: nowIso,
    },
    { onConflict: "attempt_id,question_id" }
  );

  if (upsertError) {
    // The question may not belong to this attempt's exam — surface as invalid.
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }

  await db
    .from("exam_attempts")
    .update({ last_active_at: nowIso })
    .eq("id", row.id);

  return NextResponse.json({
    ok: true,
    savedAt: nowIso,
    remainingSeconds: Math.max(
      0,
      Math.floor((new Date(row.ends_at).getTime() - Date.now()) / 1000)
    ),
  });
}
