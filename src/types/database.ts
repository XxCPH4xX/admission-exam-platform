/**
 * Hand-maintained database types mirroring supabase/schema.sql.
 * Kept in sync manually because we author SQL migrations ourselves.
 */

export type UserRole = "admin" | "student";

export type AttemptStatus = "in_progress" | "completed" | "expired";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface ExamRow {
  id: string;
  title: string;
  subject: string;
  category: string;
  /** Exam length in minutes (authoritative while no attempt is running). */
  duration_minutes: number;
  /** Auto-maintained by trigger: question count × marks_per_question. */
  total_marks: number;
  marks_per_question: number;
  /** Marks deducted per wrong answer (0 disables negative marking). */
  negative_marking: number;
  published: boolean;
  created_at: string;
}

export interface QuestionRow {
  id: string;
  exam_id: string;
  question_text: string;
  /** Public URLs of optional supporting images (diagrams, figures…). */
  image_urls: string[];
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: "A" | "B" | "C" | "D";
  /** Stable display order within an exam. */
  order_index: number;
  created_at: string;
}

/**
 * Question shape safe to expose to students during an active exam —
 * never includes `correct_answer` (enforced by a column-level GRANT too).
 */
export interface SafeQuestion {
  id: string;
  exam_id: string;
  question_text: string;
  image_urls: string[];
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  order_index: number;
}

export interface ExamAttemptRow {
  id: string;
  user_id: string;
  exam_id: string;
  status: AttemptStatus;
  started_at: string;
  /** Server-authoritative deadline: started_at + duration snapshot. */
  ends_at: string;
  submitted_at: string | null;
  last_active_at: string | null;
  /** Snapshot of exam rules taken at start (immune to later edits). */
  duration_minutes: number;
  marks_per_question: number;
  negative_marking: number;
  /** Persisted question order (supports random ordering + refresh recovery). */
  question_order: string[];
}

export interface AnswerRow {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_answer: "A" | "B" | "C" | "D" | null;
  is_correct: boolean | null;
  updated_at: string;
}

export interface ResultRow {
  id: string;
  attempt_id: string;
  score: number;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  percentage: number;
  accuracy: number;
  created_at: string;
}
