import { NextResponse, type NextRequest } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { requireAdminApi } from "@/lib/api-auth";
import {
  bulkCreateQuestions,
  createQuestion,
  deleteQuestion,
  listQuestionsByExam,
  updateQuestion,
} from "@/services/questions.service";
import { questionCreateSchema } from "@/validations/exam";

/**
 * Admin question CRUD used by the question dialog + CSV/XLSX import.
 *
 * GET    /api/admin/questions?examId=<uuid>            list
 * POST   /api/admin/questions?examId=<uuid>            create one
 * POST   /api/admin/questions?examId=<uuid>&bulk=true  create many (import)
 * PUT    /api/admin/questions?questionId=<uuid>        update
 * DELETE /api/admin/questions?questionId=<uuid>        delete
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const examId = searchParams.get("examId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(examId)) {
    return NextResponse.json({ error: "INVALID_EXAM_ID" }, { status: 400 });
  }

  try {
    const questions = await listQuestionsByExam(examId);
    return NextResponse.json({ questions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "FETCH_FAILED" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const examId = searchParams.get("examId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(examId)) {
    return NextResponse.json({ error: "INVALID_EXAM_ID" }, { status: 400 });
  }

  // Import requests get a higher rate limit than single edits.
  const isBulk = searchParams.get("bulk") === "true";
  const rl = rateLimit(
    `questions:${auth.user.id}:${getClientIp(request.headers)}`,
    isBulk ? 10 : 120,
    60_000
  );
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

  if (isBulk) {
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "EXPECTED_ARRAY" }, { status: 400 });
    }
    if (body.length > 500) {
      return NextResponse.json({ error: "TOO_MANY_ROWS", max: 500 }, { status: 400 });
    }

    const parsed = body.map((row) => questionCreateSchema.safeParse(row));
    const invalid = parsed.findIndex((p) => !p.success);
    if (invalid !== -1) {
      return NextResponse.json(
        {
          error: "VALIDATION_FAILED",
          row: invalid,
          issues: parsed[invalid].error?.issues ?? [],
        },
        { status: 422 }
      );
    }

    try {
      const count = await bulkCreateQuestions(
        examId,
        parsed.map((p) => p.data!)
      );
      return NextResponse.json({ inserted: count });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "INSERT_FAILED" },
        { status: 500 }
      );
    }
  }

  const parsed = questionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  try {
    const created = await createQuestion(examId, parsed.data!);
    return NextResponse.json({ question: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "INSERT_FAILED" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const questionId = searchParams.get("questionId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(questionId)) {
    return NextResponse.json({ error: "INVALID_QUESTION_ID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = questionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  try {
    await updateQuestion(questionId, parsed.data!);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "UPDATE_FAILED" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const questionId = searchParams.get("questionId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(questionId)) {
    return NextResponse.json({ error: "INVALID_QUESTION_ID" }, { status: 400 });
  }

  try {
    await deleteQuestion(questionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "DELETE_FAILED" },
      { status: 500 }
    );
  }
}
