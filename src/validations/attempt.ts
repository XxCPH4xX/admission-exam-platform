import { z } from "zod";
import { ANSWER_OPTIONS } from "@/lib/exam";

export const startAttemptSchema = z.object({
  examId: z.string().uuid("Invalid exam id"),
});

export const saveAnswerSchema = z.object({
  questionId: z.string().uuid("Invalid question id"),
  /** null clears the answer (marks the question as unanswered). */
  selectedAnswer: z.enum(ANSWER_OPTIONS).nullable(),
});

export const attemptIdParamSchema = z.string().uuid("Invalid attempt id");
