"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/services/auth.service";
import { getActiveAttemptId, startAttempt } from "@/services/attempts.service";

/**
 * Starts (or resumes) an attempt and forwards the student to the engine.
 * Used as a <form action> on the exam intro page.
 */
export async function startAttemptAction(formData: FormData): Promise<void> {
  const user = await requireRole("student");
  const examId = String(formData.get("examId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(examId)) {
    redirect("/student?error=invalid_exam");
  }

  let attemptId: string;
  try {
    // Resume an active attempt instead of creating a second one.
    const existing = await getActiveAttemptId(user.id, examId);
    if (existing) {
      attemptId = existing;
    } else {
      const attempt = await startAttempt(user.id, examId);
      attemptId = attempt.id;
    }
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNKNOWN";
    redirect(`/student/exams/${examId}?error=${encodeURIComponent(code)}`);
  }

  redirect(`/exam/${attemptId}`);
}
