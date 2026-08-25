import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedFirst } from "@/lib/postgrest";
import type {
  AttemptWithResult,
  ExamRow,
  ResultRow,
} from "@/types";

const admin = () => createAdminClient();

export interface AdminOverviewStats {
  totalExams: number;
  publishedExams: number;
  totalQuestions: number;
  totalAttempts: number;
}

export async function getAdminOverview(): Promise<AdminOverviewStats> {
  const [exams, questions, attempts] = await Promise.all([
    admin().from("exams").select("published"),
    admin().from("questions").select("id", { count: "exact", head: true }),
    admin()
      .from("exam_attempts")
      .select("id", { count: "exact", head: true }),
  ]);

  const examRows = (exams.data ?? []) as { published: boolean }[];

  return {
    totalExams: examRows.length,
    publishedExams: examRows.filter((e) => e.published).length,
    totalQuestions: questions.count ?? 0,
    totalAttempts: attempts.count ?? 0,
  };
}

export interface RecentAttemptItem extends AttemptWithResult {
  studentName: string;
  studentEmail: string;
}

export async function getRecentAttempts(limit = 8): Promise<RecentAttemptItem[]> {
  const { data, error } = await admin()
    .from("exam_attempts")
    .select(
      `*,
       results(*),
       exams(id, title, subject, category),
       users!exam_attempts_user_id_fkey(name, email)`
    )
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  type Row = Record<string, unknown>;
  return (data as unknown as Row[]).map((row) => ({
    attempt: row as never,
    exam: (row.exams as Row) as never,
    result: embedFirst(row.results as ResultRow | ResultRow[] | null),
    studentName: ((row.users as Row | null)?.name as string) ?? "—",
    studentEmail: ((row.users as Row | null)?.email as string) ?? "",
  }));
}

/** All completed attempts with student + exam info (admin results page). */
export async function getAllCompletedAttempts(limit = 200): Promise<RecentAttemptItem[]> {
  const rows = await getRecentAttempts(limit);
  // Supabase orders only by started_at; keep completed ones prominent.
  return rows;
}

export interface StudentPerformance {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  examsTaken: number;
  avgScorePercent: number;
  bestScorePercent: number;
}

export async function getStudentPerformances(): Promise<StudentPerformance[]> {
  const { data: users, error } = await admin()
    .from("users")
    .select("id, name, email, created_at, role")
    .eq("role", "student")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const { data: joined, error: jErr } = await admin()
    .from("results")
    .select("percentage, attempt_id, exam_attempts(user_id)");

  if (jErr) throw new Error(jErr.message);

  const perUser = new Map<string, number[]>();
  for (const r of (joined ?? []) as unknown as {
    percentage: number;
    exam_attempts: { user_id: string } | null;
  }[]) {
    const uid = r.exam_attempts?.user_id;
    if (!uid) continue;
    (perUser.get(uid) ?? perUser.set(uid, []).get(uid)!).push(Number(r.percentage));
  }

  return users.map((u) => {
    const scores = perUser.get(u.id) ?? [];
    const avg = scores.length
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.created_at,
      examsTaken: scores.length,
      avgScorePercent: Math.round(avg * 10) / 10,
      bestScorePercent: scores.length ? Math.max(...scores) : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Admin analytics
// ---------------------------------------------------------------------------

export interface SubjectStat {
  subject: string;
  attempts: number;
  avgAccuracy: number;
}

export async function getSubjectStats(): Promise<SubjectStat[]> {
  const { data, error } = await admin()
    .from("exam_attempts")
    .select(
      `status,
       exams(subject),
       results(accuracy)`
    );

  if (error) throw new Error(error.message);

  type Row = {
    status: string;
    exams: { subject: string } | null;
    results: { accuracy: number } | { accuracy: number }[] | null;
  };

  const buckets = new Map<string, { acc: number; n: number }>();
  for (const row of (data ?? []) as unknown as Row[]) {
    if (row.status === "in_progress") continue;
    const subject = row.exams?.subject ?? "—";
    const accuracy = Number(embedFirst(row.results)?.accuracy ?? 0);
    const b = buckets.get(subject) ?? { acc: 0, n: 0 };
    b.acc += accuracy;
    b.n += 1;
    buckets.set(subject, b);
  }

  return [...buckets.entries()]
    .map(([subject, b]) => ({
      subject,
      attempts: b.n,
      avgAccuracy: b.n ? Math.round((b.acc / b.n) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.attempts - a.attempts);
}

export interface ExamParticipationStat {
  examId: string;
  title: string;
  subject: string;
  category: string;
  published: boolean;
  attempts: number;
  avgScorePercent: number;
}

export async function getExamParticipation(): Promise<ExamParticipationStat[]> {
  const { data: exams, error } = await admin()
    .from("exams")
    .select("id, title, subject, category, published")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const { data: rows, error: rErr } = await admin()
    .from("exam_attempts")
    .select(`exam_id, status, results(percentage)`);

  if (rErr) throw new Error(rErr.message);

  type Row = {
    exam_id: string;
    status: string;
    results: { percentage: number } | { percentage: number }[] | null;
  };

  const stats = new Map<string, { n: number; sum: number }>();
  for (const row of (rows ?? []) as unknown as Row[]) {
    if (row.status === "in_progress") continue;
    const s = stats.get(row.exam_id) ?? { n: 0, sum: 0 };
    s.n += 1;
    s.sum += Number(embedFirst(row.results)?.percentage ?? 0);
    stats.set(row.exam_id, s);
  }

  return (exams as ExamRow[]).map((e) => {
    const s = stats.get(e.id);
    return {
      examId: e.id,
      title: e.title,
      subject: e.subject,
      category: e.category,
      published: e.published,
      attempts: s?.n ?? 0,
      avgScorePercent: s?.n ? Math.round((s.sum / s.n) * 10) / 10 : 0,
    };
  });
}
