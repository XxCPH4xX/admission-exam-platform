"use client";

import { create } from "zustand";
import { ANSWER_OPTIONS, type AnswerOption } from "@/lib/exam";
import type { AttemptSession, SafeQuestion } from "@/types";

type SyncStatus = "synced" | "pending" | "error";

interface PendingWrite {
  questionId: string;
  selectedAnswer: AnswerOption | null;
  enqueuedAt: number;
}

interface ExamEngineState {
  // Hydrated session
  attemptId: string | null;
  endsAtIso: string | null;
  questions: SafeQuestion[];
  answers: Record<string, AnswerOption>;
  currentIndex: number;

  // Sync machinery
  syncStatuses: Record<string, SyncStatus>;
  pendingQueue: PendingWrite[];
  lastSyncedAt: number | null;
  restoreNotice: boolean;

  // Lifecycle
  hydrated: boolean;
  submitting: boolean;
  submittedResultUrl: string | null;
  timeUp: boolean;

  hydrate: (session: AttemptSession, localBackupAnswers: Record<string, AnswerOption> | null) => void;
  setCurrent: (index: number) => void;
  goToNext: () => void;
  goToPrev: () => void;
  selectAnswer: (questionId: string, answer: AnswerOption | null) => void;
  flushPending: () => Promise<void>;
  markSubmitting: () => void;
  setSubmitted: (resultUrl: string) => void;
  setTimeUp: () => void;
  reset: () => void;
}

const BACKUP_PREFIX = "exam-backup:";

function backupKey(attemptId: string) {
  return `${BACKUP_PREFIX}${attemptId}`;
}

function writeBackup(state: Pick<ExamEngineState, "attemptId" | "answers" | "currentIndex">) {
  if (!state.attemptId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      backupKey(state.attemptId),
      JSON.stringify({
        answers: state.answers,
        currentIndex: state.currentIndex,
        savedAt: Date.now(),
      })
    );
  } catch {
    // Storage full / private mode — in-memory + server saves still cover us.
  }
}

export function readLocalBackup(attemptId: string): Record<string, AnswerOption> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(backupKey(attemptId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { answers?: Record<string, string> };
    if (!parsed.answers) return null;
    const clean: Record<string, AnswerOption> = {};
    for (const [qid, ans] of Object.entries(parsed.answers)) {
      if ((ANSWER_OPTIONS as readonly string[]).includes(ans)) {
        clean[qid] = ans as AnswerOption;
      }
    }
    return clean;
  } catch {
    return null;
  }
}

export function clearLocalBackup(attemptId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(backupKey(attemptId));
  } catch {
    // ignore
  }
}

export const useExamEngine = create<ExamEngineState>((set, get) => ({
  attemptId: null,
  endsAtIso: null,
  questions: [],
  answers: {},
  currentIndex: 0,
  syncStatuses: {},
  pendingQueue: [],
  lastSyncedAt: null,
  restoreNotice: false,
  hydrated: false,
  submitting: false,
  submittedResultUrl: null,
  timeUp: false,

  hydrate: (session, localBackupAnswers) => {
    const serverAnswers = session.answers;

    // Merge: any answer found only in the local backup (never reached the
    // server before a crash/refresh) is restored into state and re-synced.
    const merged = { ...serverAnswers };
    const recovered: Record<string, AnswerOption> = {};
    if (localBackupAnswers) {
      for (const [qid, ans] of Object.entries(localBackupAnswers)) {
        if (!(qid in merged)) {
          merged[qid] = ans;
          recovered[qid] = ans;
        }
      }
    }

    set({
      attemptId: session.attempt.id,
      endsAtIso: session.attempt.ends_at,
      questions: session.questions,
      answers: merged,
      currentIndex: 0,
      hydrated: true,
      restoreNotice:
        Object.keys(recovered).length > 0 ||
        Object.keys(serverAnswers).length > 0,
      pendingQueue: Object.entries(recovered).map(([questionId, selectedAnswer]) => ({
        questionId,
        selectedAnswer,
        enqueuedAt: Date.now(),
      })),
      timeUp: false,
      submitting: false,
      submittedResultUrl: null,
    });

    writeBackup(get());
    if (get().pendingQueue.length > 0) void get().flushPending();
  },

  setCurrent: (index) => {
    const total = get().questions.length;
    if (index < 0 || index >= total) return;
    set({ currentIndex: index });
    writeBackup(get());
  },

  goToNext: () => get().setCurrent(get().currentIndex + 1),
  goToPrev: () => get().setCurrent(get().currentIndex - 1),

  selectAnswer: (questionId, answer) => {
    // Optimistic update + durable queue entry + immediate background sync.
    set((state) => {
      const answers = { ...state.answers };
      if (answer === null) delete answers[questionId];
      else answers[questionId] = answer;

      return {
        answers,
        syncStatuses: { ...state.syncStatuses, [questionId]: "pending" },
        pendingQueue: [
          ...state.pendingQueue.filter((w) => w.questionId !== questionId),
          { questionId, selectedAnswer: answer, enqueuedAt: Date.now() },
        ],
      };
    });
    writeBackup(get());
    void get().flushPending();
  },

  flushPending: async () => {
    const state = get();
    if (!state.attemptId || state.submitting || state.timeUp) return;
    if (state.pendingQueue.length === 0) return;
    // Prevent overlapping flushes.
    if (flushInFlight) return;
    flushInFlight = true;

    const queue = [...get().pendingQueue];
    const remaining: PendingWrite[] = [...get().pendingQueue];
    let statuses: Record<string, SyncStatus> = { ...get().syncStatuses };
    let syncedAt = get().lastSyncedAt;

    for (const write of queue) {
      try {
        const res = await fetch(`/api/attempts/${get().attemptId}/answers`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            questionId: write.questionId,
            selectedAnswer: write.selectedAnswer,
          }),
        });

        if (res.status === 409) {
          const body = await res.json().catch(() => ({}));
          if (body.error === "ATTEMPT_EXPIRED" || body.submitted) {
            // Deadline hit while saving — hand over to the auto-submit flow.
            flushInFlight = false;
            get().setTimeUp();
            set({ pendingQueue: [], syncStatuses: {} });
            return;
          }
          throw new Error("CONFLICT");
        }

        if (res.status === 429) {
          // Rate-limited: keep the item queued and back off this round.
          continue;
        }
        if (!res.ok) throw new Error(String(res.status));

        // Acked → drop from queue
        const idx = remaining.findIndex((w) => w.questionId === write.questionId);
        if (idx !== -1) remaining.splice(idx, 1);
        statuses = { ...statuses, [write.questionId]: "synced" };

        const ack = await res.json().catch(() => null);
        if (typeof ack?.remainingSeconds === "number") {
          set({
            endsAtIso: new Date(Date.now() + ack.remainingSeconds * 1000).toISOString(),
          });
        }
        syncedAt = Date.now();
      } catch {
        statuses = { ...statuses, [write.questionId]: "error" };
      }
    }

    set({
      pendingQueue: remaining,
      syncStatuses: statuses,
      lastSyncedAt: syncedAt,
    });

    writeBackup(get());
    flushInFlight = false;
  },

  markSubmitting: () => set({ submitting: true }),
  setSubmitted: (resultUrl) => set({ submittedResultUrl: resultUrl, submitting: false }),
  setTimeUp: () => set({ timeUp: true }),

  reset: () =>
    set({
      attemptId: null,
      endsAtIso: null,
      questions: [],
      answers: {},
      currentIndex: 0,
      syncStatuses: {},
      pendingQueue: [],
      lastSyncedAt: null,
      restoreNotice: false,
      hydrated: false,
      submitting: false,
      submittedResultUrl: null,
      timeUp: false,
    }),
}));

let flushInFlight = false;
