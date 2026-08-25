import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedFirst } from "@/lib/postgrest";
import type {
  AttemptReview,
  AttemptWithResult,
  ExamRow,
  QuestionRow,
  ResultRow,
  ReviewQuestionItem,
  ReviewAnswerStatus,
} from "@/types";

const admin = () => createAdminClient();

/**
 * All student reads are scoped by explicit user_id filters (defense in depth
 * alongside RLS) using the service-role client.
 */

export async function getStudentStats(userId: string) {
  const { data, error } = await admin()
    .from("exam_attempts")
    .select(`status, results(percentage, accuracy, score, correct_count, wrong_count, skipped_count)`)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  type Row = { status: string; results: ResultRow | ResultRow[] | null };

  const completed = (data ?? [])
    .map((r) => r as unknown as Row)
    .filter((r) => r.status !== "in_progress")
    .map((r) => embedFirst(r.results))
    .filter((res): res is ResultRow => res !== null)
    .map((res) => Number(res.percentage));

  return {
    totalExams: completed.length,
    averageScorePercent: completed.length
      ? Math.round((completed.reduce((a, b) => a + b, 0) / completed.length) * 10) / 10
      : 0,
    highestScorePercent: completed.length ? Math.max(...completed) : 0,
    lowestScorePercent: completed.length ? Math.min(...completed) : 0,
  };
}

/** Attempts for the history page / dashboard recent list. */
export async function getUserAttempts(
  userId: string,
  limit = 50,
  completedOnly = false
): Promise<AttemptWithResult[]> {
  const query = admin()
    .from("exam_attempts")
    .select(`*, results(*), exams(id, title, subject, category)`)
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  type Row = Record<string, unknown>;

  const rows = (data as unknown as Row[]) ?? [];
  const items: AttemptWithResult[] = rows.map((row) => ({
    attempt: row as unknown as AttemptWithResult["attempt"],
    exam: row.exams as unknown as AttemptWithResult["exam"],
    result: embedFirst(row.results as ResultRow | ResultRow[] | null),
  }));

  return completedOnly
    ? items.filter((item) => item.attempt.status !== "in_progress")
    : items;
}

export async function getActiveAttempt(
  userId: string,
  examId: string
): Promise<AttemptWithResult | null> {
  const { data, error } = await admin()
    .from("exam_attempts")
    .select(`*, results(*), exams(id, title, subject, category)`)
    .eq("user_id", userId)
    .eq("exam_id", examId)
    .order("started_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  type Row = Record<string, unknown>;
  const row = (data as unknown as Row[] | null)?.[0];
  if (!row) return null;

  return {
    attempt: row as never,
    exam: row.exams as never,
    result: embedFirst(row.results as ResultRow | ResultRow[] | null),
  };
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export async function getAttemptReview(
  userId: string,
  attemptId: string
): Promise<AttemptReview | null> {
  // Attempt must belong to this user and be finalized.
  const { data: attempt, error } = await admin()
    .from("exam_attempts")
    .select(`*, exams(id, title, subject, category), results(*)`)
    .eq("id", attemptId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  type AttemptJoined = Record<string, unknown>;
  const row = attempt as unknown as AttemptJoined | null;
  if (!row) return null;

  // `results` embeds as an OBJECT (unique FK → one-to-one), never an array —
  // index via embedFirst or result reads back undefined and the page crashes.
  const result = embedFirst(row.results as ResultRow | ResultRow[] | null);
  if (!result) return null; // not finalized yet

  const status = row.status as string;
  if (status === "in_progress") return null;

  const examId = row.exam_id as string;

  // Full questions (incl. correct answers) — service role, post-submission only.
  const [{ data: questions }, { data: answers }] = await Promise.all([
    admin()
      .from("questions")
      .select("*")
      .eq("exam_id", examId)
      .order("order_index", { ascending: true }),
    admin()
      .from("answers")
      .select("question_id, selected_answer")
      .eq("attempt_id", attemptId),
  ]);

  const answerMap = new Map(
    ((answers ?? []) as { question_id: string; selected_answer: string | null }[]).map(
      (a) => [
        a.question_id,
        (["A", "B", "C", "D"] as const).includes(a.selected_answer as "A")
          ? (a.selected_answer as "A" | "B" | "C" | "D")
          : null,
      ]
    )
  );

  const items: ReviewQuestionItem[] = ((questions ?? []) as QuestionRow[]).map(
    (q, index) => {
      const selected = answerMap.get(q.id) ?? null;
      const stat: ReviewAnswerStatus =
        selected === null
          ? "skipped"
          : selected === q.correct_answer
            ? "correct"
            : "wrong";
      return { index, question: q, selectedAnswer: selected, status: stat };
    }
  );

  const exam = row.exams as Pick<ExamRow, "title" | "subject" | "category">;

  return {
    attemptId,
    examTitle: exam.title,
    subject: exam.subject,
    submittedAt: (row.submitted_at as string | null) ?? null,
    result,
    marksPerQuestion: Number(row.marks_per_question),
    negativeMarking: Number(row.negative_marking),
    items,
  };
}

/** Accuracy trend for analytics: chronological list of finished attempts. */
export interface TrendPoint {
  label: string;
  date: string;
  percentage: number;
  accuracy: number;
  score: number;
  totalMarks: number;
}

export async function getStudentTrend(userId: string): Promise<TrendPoint[]> {
  const { data, error } = await admin()
    .from("exam_attempts")
    .select(
      `started_at, duration_minutes, marks_per_question,
       exams(title),
       results(score, correct_count, wrong_count, skipped_count, percentage, accuracy)`
    )
    .eq("user_id", userId)
    .neq("status", "in_progress")
    .order("started_at", { ascending: true });

  if (error) throw new Error(error.message);

  type TrendResult = {
    score: number;
    correct_count: number;
    wrong_count: number;
    skipped_count: number;
    percentage: number;
    accuracy: number;
  };
  type Row = {
    started_at: string;
    marks_per_question: number | string;
    exams: { title: string } | null;
    results: TrendResult | TrendResult[] | null;
  };

  return ((data ?? []) as unknown as Row[])
    .map((r) => ({ r, res: embedFirst(r.results) }))
    .filter((x): x is { r: Row; res: TrendResult } => x.res !== null)
    .map(({ r, res }) => {
      const totalQ =
        Number(res.correct_count) + Number(res.wrong_count) + Number(res.skipped_count);
      return {
        label: r.exams?.title ?? "Exam",
        date: r.started_at,
        percentage: Number(res.percentage),
        accuracy: Number(res.accuracy),
        score: Number(res.score),
        totalMarks: totalQ * Number(r.marks_per_question),
      };
    });
}
