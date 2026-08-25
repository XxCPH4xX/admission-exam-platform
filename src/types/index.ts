import type {
  AnswerRow,
  AttemptStatus,
  ExamAttemptRow,
  ExamRow,
  QuestionRow,
  ResultRow,
  SafeQuestion,
  UserRow,
  UserRole,
} from "./database";
import type { AnswerOption } from "@/lib/exam";

export type {
  AnswerRow,
  AttemptStatus,
  ExamAttemptRow,
  ExamRow,
  QuestionRow,
  ResultRow,
  SafeQuestion,
  UserRow,
  UserRole,
};

export type { AnswerOption };

/** Student-facing exam card on dashboards/lists. */
export interface ExamSummary extends ExamRow {
  question_count: number;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

/** Full state needed to (re)hydrate the exam engine after any interruption. */
export interface AttemptSession {
  attempt: ExamAttemptRow;
  exam: Pick<ExamRow, "id" | "title" | "subject" | "category">;
  questions: SafeQuestion[];
  answers: Record<string, "A" | "B" | "C" | "D">;
  /** Server-computed seconds remaining at response time. */
  remainingSeconds: number;
}

export type ReviewAnswerStatus = "correct" | "wrong" | "skipped";

export interface ReviewQuestionItem {
  index: number;
  question: QuestionRow;
  selectedAnswer: "A" | "B" | "C" | "D" | null;
  status: ReviewAnswerStatus;
}

export interface AttemptReview {
  attemptId: string;
  examTitle: string;
  subject: string;
  submittedAt: string | null;
  result: ResultRow;
  marksPerQuestion: number;
  negativeMarking: number;
  items: ReviewQuestionItem[];
}

export interface AttemptWithResult {
  attempt: ExamAttemptRow;
  exam: Pick<ExamRow, "id" | "title" | "subject" | "category">;
  result: ResultRow | null;
}

export interface StudentStats {
  totalExams: number;
  averageScorePercent: number;
  highestScorePercent: number;
  lowestScorePercent: number;
  averageAccuracy: number;
}

export interface ActionState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}
