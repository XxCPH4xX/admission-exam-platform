"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/services/auth.service";
import {
  createExam,
  deleteExam,
  setExamPublished,
  updateExam,
} from "@/services/exams.service";
import { examCreateSchema, examUpdateSchema } from "@/validations/exam";
import type { ActionState } from "@/types";

function fieldErrorsFrom(zodError: {
  issues: { path: PropertyKey[]; message: string }[];
}): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of zodError.issues) {
    const key = String(issue.path[0] ?? "form");
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export async function createExamAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole("admin");

  const parsed = examCreateSchema.safeParse({
    title: formData.get("title"),
    subject: formData.get("subject"),
    category: formData.get("category"),
    durationMinutes: formData.get("durationMinutes"),
    marksPerQuestion: formData.get("marksPerQuestion"),
    negativeMarking: formData.get("negativeMarking"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  try {
    const exam = await createExam(parsed.data);
    revalidatePath("/admin/exams");
    revalidatePath("/admin");
    return { status: "success", message: exam.id };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Failed to create exam",
    };
  }
}

export async function updateExamAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole("admin");

  const examId = String(formData.get("examId") ?? "");
  if (!examId) return { status: "error", message: "Missing exam id" };

  const parsed = examUpdateSchema.safeParse({
    title: formData.get("title"),
    subject: formData.get("subject"),
    category: formData.get("category"),
    durationMinutes: formData.get("durationMinutes"),
    marksPerQuestion: formData.get("marksPerQuestion"),
    negativeMarking: formData.get("negativeMarking"),
    published: formData.get("published") === "on" || formData.get("published") === "true",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  try {
    await updateExam(examId, parsed.data);
    revalidatePath("/admin/exams");
    revalidatePath(`/admin/exams/${examId}`);
    revalidatePath("/student");
    return { status: "success", message: "saved" };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Failed to update exam",
    };
  }
}

export async function togglePublishAction(formData: FormData): Promise<void> {
  await requireRole("admin");
  const examId = String(formData.get("examId") ?? "");
  const published = String(formData.get("published") ?? "") === "true";
  if (!examId) return;

  await setExamPublished(examId, published);
  revalidatePath("/admin/exams");
  revalidatePath("/student");
}

export async function deleteExamAction(formData: FormData): Promise<void> {
  await requireRole("admin");
  const examId = String(formData.get("examId") ?? "");
  if (!examId) return;

  await deleteExam(examId);
  revalidatePath("/admin/exams");
  revalidatePath("/admin");
}
