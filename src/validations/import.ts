import { z } from "zod";
import { imageUrlSchema, questionText, correctAnswerSchema } from "./exam";

const optionCell = z
  .string()
  .trim()
  .min(1, "Option is required")
  .max(2000);

/**
 * One row of an imported CSV/XLSX file.
 * `correctAnswer` accepts A–D or Bangla ক/খ/গ/ঘ (normalized before validation).
 */
export const importRowSchema = z.object({
  question: questionText,
  optionA: optionCell,
  optionB: optionCell,
  optionC: optionCell,
  optionD: optionCell,
  correctAnswer: z.string().transform((v) => v.trim()).pipe(correctAnswerSchema),
  imageUrl: imageUrlSchema.nullable(),
});

export type ImportRow = z.infer<typeof importRowSchema>;

export interface ImportRowError {
  rowNumber: number;
  errors: string[];
}

export interface ParsedImport {
  rows: ImportRow[];
  errors: ImportRowError[];
  totalRows: number;
}
