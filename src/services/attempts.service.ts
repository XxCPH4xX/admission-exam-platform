import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { FEATURES } from "@/lib/features";
import { hashSeed, seededShuffle } from "@/lib/shuffle";
import type {
  AttemptSession,
  ExamRow,
  ExamAttemptRow,
  SafeQuestion,
} from "@/types";

const admin = () => createAdminClient();

/**
 * Start a new attempt for (user, exam).
 * Throws typed error strings the caller maps to user-facing messages.
 */
export async function startAttempt(
  userId: string,
  examId: string
): Promise<ExamAttemptRow> {
  // Lazy expiry first so stale attempts can't block starting.
  await admin().rpc("expire_all_stale_attempts");

  const { data: exam } = await admin()
    .from("exams")
    .select("*")
    .eq("id", examId)
    .maybeSingle();
  if (!exam) throw new Error("EXAM_NOT_FOUND");
  if (!(exam as ExamRow).published) throw new Error("EXAM_NOT_PUBLISHED");

  const examRow = exam as ExamRow;

  const questionCount = await countQuestions(examId);
  if (questionCount === 0) throw new Error("NO_QUESTIONS");

  // Retake policy
  if (!FEATURES.retakeExam) {
    const existing = await findAnyAttempt(userId, examId);
    if (existing && existing.status !== "in_progress") {
      throw new Error("ALREADY_TAKEN");
    }
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + examRow.duration_minutes * 60_000);

  // Question order: shuffled per attempt when the feature flag is on.
  const { data: idsData } = await admin()
    .from("questions")
    .select("id")
    .eq("exam_id", examId)
    .order("order_index");
  let ids = (idsData ?? []).map((r) => r.id as string);
  if (FEATURES.randomQuestionOrder) {
    ids = seededShuffle(ids, hashSeed(`${userId}:${examId}:${now.getTime()}`));
  }

  const { data: attempt, error } = await admin()
    .from("exam_attempts")
    .insert({
      user_id: userId,
      exam_id: examId,
      status: "in_progress",
      started_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      duration_minutes: examRow.duration_minutes,
      marks_per_question: examRow.marks_per_question,
      negative_marking: examRow.negative_marking,
      question_order: ids,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505" || /duplicate/i.test(error.message)) {
      throw new Error("ATTEMPT_EXISTS");
    }
    throw new Error(error.message);
  }
  return attempt as ExamAttemptRow;
}

/** Id of an in-progress attempt for (user, exam) whose time is still running. */
export async function getActiveAttemptId(
  userId: string,
  examId: string
): Promise<string | null> {
  // `ends_at > now()` matters: an expired-but-not-yet-finalized attempt would
  // bounce the student into a dead session instead of a fresh start.
  const { data } = await admin()
    .from("exam_attempts")
    .select("id")
    .eq("user_id", userId)
    .eq("exam_id", examId)
    .eq("status", "in_progress")
    .gt("ends_at", new Date().toISOString())
    .limit(1);
  return (data?.[0] as { id: string } | undefined)?.id ?? null;
}

async function countQuestions(examId: string): Promise<number> {
  const { count } = await admin()
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId);
  return count ?? 0;
}

async function findAnyAttempt(
  userId: string,
  examId: string
): Promise<ExamAttemptRow | null> {
  const { data } = await admin()
    .from("exam_attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("exam_id", examId)
    .order("started_at", { ascending: false })
    .limit(1);
  return (data?.[0] as ExamAttemptRow | undefined) ?? null;
}

/**
 * Load everything the engine needs to run/resume an attempt.
 * Returns null when the attempt doesn't belong to the user or isn't active.
 */
export async function getAttemptSession(
  userId: string,
  attemptId: string
): Promise<AttemptSession | null> {
  const { data: row } = await admin()
    .from("exam_attempts")
    .select(`*, exams(id, title, subject, category)`)
    .eq("id", attemptId)
    .eq("user_id", userId)
    .maybeSingle();

  type Row = Record<string, unknown>;
  const r = row as unknown as Row | null;
  if (!r) return null;

  const attempt = r as unknown as ExamAttemptRow;
  const exam = r.exams as AttemptSession["exam"];

  if (attempt.status !== "in_progress") return null;

  // Questions WITHOUT correct answers (safe column list).
  const { data: questionsRaw } = await admin()
    .from("questions")
    .select(
      "id, exam_id, question_text, image_urls, option_a, option_b, option_c, option_d, order_index"
    )
    .eq("exam_id", attempt.exam_id);

  const byId = new Map(
    ((questionsRaw ?? []) as SafeQuestion[]).map((q) => [q.id, q])
  );

  // Persisted order → stable across refreshes
  const orderedQuestions = (attempt.question_order ?? [])
    .map((id) => byId.get(id))
    .filter((q): q is SafeQuestion => Boolean(q));

  // If ordering is missing/mismatched (e.g. questions added mid-attempt),
  // fall back to natural order so nothing disappears.
  const questions =
    orderedQuestions.length > 0 ? orderedQuestions : ((questionsRaw ?? []) as SafeQuestion[]);

  const { data: answersRaw } = await admin()
    .from("answers")
    .select("question_id, selected_answer")
    .eq("attempt_id", attemptId);

  const answers: Record<string, "A" | "B" | "C" | "D"> = {};
  for (const a of (answersRaw ?? []) as {
    question_id: string;
    selected_answer: string | null;
  }[]) {
    if (
      a.selected_answer === "A" ||
      a.selected_answer === "B" ||
      a.selected_answer === "C" ||
      a.selected_answer === "D"
    ) {
      answers[a.question_id] = a.selected_answer;
    }
  }

  const remainingSeconds = Math.max(
    0,
    Math.floor((new Date(attempt.ends_at).getTime() - Date.now()) / 1000)
  );

  return { attempt, exam, questions, answers, remainingSeconds };
}
