import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { QuestionRow } from "@/types";

const questionsAdmin = () => createAdminClient().from("questions");

export async function listQuestionsByExam(examId: string): Promise<QuestionRow[]> {
  const { data, error } = await questionsAdmin()
    .select("*")
    .eq("exam_id", examId)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data as QuestionRow[];
}

export async function countQuestionsByExam(examId: string): Promise<number> {
  const { count, error } = await questionsAdmin()
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export interface QuestionValues {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: "A" | "B" | "C" | "D";
  imageUrls: string[];
}

export async function createQuestion(
  examId: string,
  values: QuestionValues
): Promise<QuestionRow> {
  // Append to the end of the current ordering.
  const nextIndex = await countQuestionsByExam(examId);

  const { data, error } = await questionsAdmin()
    .insert({
      exam_id: examId,
      question_text: values.questionText,
      option_a: values.optionA,
      option_b: values.optionB,
      option_c: values.optionC,
      option_d: values.optionD,
      correct_answer: values.correctAnswer,
      image_urls: values.imageUrls,
      order_index: nextIndex,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as QuestionRow;
}

export async function updateQuestion(
  id: string,
  values: QuestionValues
): Promise<void> {
  const { error } = await questionsAdmin()
    .update({
      question_text: values.questionText,
      option_a: values.optionA,
      option_b: values.optionB,
      option_c: values.optionC,
      option_d: values.optionD,
      correct_answer: values.correctAnswer,
      image_urls: values.imageUrls,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function deleteQuestion(id: string): Promise<void> {
  const { error } = await questionsAdmin().delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Bulk insert used by CSV/XLSX import. Returns number of rows inserted. */
export async function bulkCreateQuestions(
  examId: string,
  rows: QuestionValues[]
): Promise<number> {
  if (rows.length === 0) return 0;

  const startIndex = await countQuestionsByExam(examId);
  const payload = rows.map((values, i) => ({
    exam_id: examId,
    question_text: values.questionText,
    option_a: values.optionA,
    option_b: values.optionB,
    option_c: values.optionC,
    option_d: values.optionD,
    correct_answer: values.correctAnswer,
    image_urls: values.imageUrls,
    order_index: startIndex + i,
  }));

  const { error } = await questionsAdmin().insert(payload);
  if (error) throw new Error(error.message);
  return payload.length;
}
