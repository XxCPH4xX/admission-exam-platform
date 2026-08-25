import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ExamRow, ExamSummary } from "@/types";

/**
 * Admin exam data access. Uses the service-role client because admin
 * operations must bypass RLS (and read columns students cannot).
 */
const examsAdmin = () => createAdminClient().from("exams");

export async function listExams(): Promise<ExamSummary[]> {
  const { data, error } = await examsAdmin()
    .select("*, questions(count)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return data.map((row) => ({
    ...(row as unknown as ExamRow),
    question_count: row.questions?.[0]?.count ?? 0,
  }));
}

/** Exams a student may see: published only. Uses RLS-safe admin select too
 * (same result, but explicit about the filter). */
export async function listPublishedExams(): Promise<ExamSummary[]> {
  const { data, error } = await examsAdmin()
    .select("*, questions(count)")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return data.map((row) => ({
    ...(row as unknown as ExamRow),
    question_count: row.questions?.[0]?.count ?? 0,
  }));
}

export async function getExam(id: string): Promise<ExamSummary | null> {
  const { data, error } = await examsAdmin()
    .select("*, questions(count)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    ...(data as unknown as ExamRow),
    question_count: data.questions?.[0]?.count ?? 0,
  };
}

export interface ExamCreateValues {
  title: string;
  subject: string;
  category: string;
  durationMinutes: number;
  marksPerQuestion: number;
  negativeMarking: number;
}

export async function createExam(values: ExamCreateValues): Promise<ExamRow> {
  const { data, error } = await examsAdmin()
    .insert({
      title: values.title,
      subject: values.subject,
      category: values.category,
      duration_minutes: values.durationMinutes,
      marks_per_question: values.marksPerQuestion,
      negative_marking: values.negativeMarking,
      published: false,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as ExamRow;
}

export interface ExamUpdateValues extends ExamCreateValues {
  published: boolean;
}

export async function updateExam(
  id: string,
  values: ExamUpdateValues
): Promise<void> {
  const { error } = await examsAdmin()
    .update({
      title: values.title,
      subject: values.subject,
      category: values.category,
      duration_minutes: values.durationMinutes,
      marks_per_question: values.marksPerQuestion,
      negative_marking: values.negativeMarking,
      published: values.published,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function setExamPublished(
  id: string,
  published: boolean
): Promise<void> {
  const { error } = await examsAdmin()
    .update({ published })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteExam(id: string): Promise<void> {
  // Cascades to questions / attempts / answers / results.
  const { error } = await examsAdmin().delete().eq("id", id);
  if (error) throw new Error(error.message);
}
