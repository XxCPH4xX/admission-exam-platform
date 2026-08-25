import { z } from "zod";
import { ANSWER_OPTIONS } from "@/lib/exam";

/** Shared field primitives — single source of truth for form + server checks. */
const title = z
  .string()
  .trim()
  .min(3, "Title must be at least 3 characters")
  .max(200, "Title must be at most 200 characters");

const subject = z.string().trim().min(2, "Subject is required").max(100);
const category = z.string().trim().min(2, "Category is required").max(100);

const durationMinutes = z.coerce
  .number({ message: "Duration is required" })
  .int("Duration must be a whole number of minutes")
  .min(1, "Duration must be at least 1 minute")
  .max(600, "Duration cannot exceed 10 hours");

const marksPerQuestion = z.coerce
  .number({ message: "Marks per question is required" })
  .positive("Marks must be greater than 0")
  .max(100);

const negativeMarking = z.coerce
  .number({ message: "Negative marking is required" })
  .min(0, "Cannot be negative")
  .max(100);

export const examCreateSchema = z.object({
  title,
  subject,
  category,
  durationMinutes,
  marksPerQuestion,
  negativeMarking,
});

export const examUpdateSchema = examCreateSchema.extend({
  published: z.boolean(),
});

export type ExamCreateInput = z.infer<typeof examCreateSchema>;
export type ExamUpdateInput = z.infer<typeof examUpdateSchema>;

export const questionText = z
  .string()
  .trim()
  .min(1, "Question text is required")
  .max(5000, "Question text is too long");

const optionText = z
  .string()
  .trim()
  .min(1, "Option text is required")
  .max(2000, "Option text is too long");

export const correctAnswerSchema = z.enum(ANSWER_OPTIONS, {
  message: "Select the correct answer (A–D)",
});

export const imageUrlSchema = z
  .string()
  .trim()
  .url("Must be a valid URL")
  .max(2048)
  .refine((v) => /^https?:\/\//i.test(v), "Only http(s) URLs are allowed");

export const questionCreateSchema = z.object({
  questionText,
  optionA: optionText,
  optionB: optionText,
  optionC: optionText,
  optionD: optionText,
  correctAnswer: correctAnswerSchema,
  imageUrls: z.array(imageUrlSchema).max(5, "At most 5 images per question"),
});

export const questionUpdateSchema = questionCreateSchema;

export type QuestionInput = z.infer<typeof questionCreateSchema>;
