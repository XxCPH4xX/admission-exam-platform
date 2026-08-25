"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize,
  Minimize,
  Save,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QuestionPalette } from "@/components/exam/question-palette";
import { QuestionView } from "@/components/exam/question-view";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useExamTimer } from "@/hooks/use-exam-timer";
import { FEATURES } from "@/lib/features";
import { ANSWER_OPTIONS, formatCountdown, type AnswerOption } from "@/lib/exam";
import { hashSeed, seededShuffle } from "@/lib/shuffle";
import {
  clearLocalBackup,
  readLocalBackup,
  useExamEngine,
} from "@/store/exam-engine";

async function fetchSession(attemptId: string) {
  const res = await fetch(`/api/attempts/${attemptId}/session`);
  if (res.status === 404) throw new Error("ATTEMPT_NOT_ACTIVE");
  if (!res.ok) throw new Error("FETCH_FAILED");
  return res.json();
}

export function ExamEngine({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const {
    hydrated,
    hydrate,
    questions,
    answers,
    currentIndex,
    setCurrent,
    goToNext,
    goToPrev,
    selectAnswer,
    flushPending,
    syncStatuses,
    pendingQueue,
    lastSyncedAt,
    restoreNotice,
    endsAtIso,
    submitting,
    timeUp,
    setSubmitted,
    markSubmitting,
  } = useExamEngine();

  // ---------------------------------------------------------------------
  // Session load + recovery hydration
  // ---------------------------------------------------------------------
  const sessionQuery = useQuery({
    queryKey: ["attempt-session", attemptId],
    queryFn: () => fetchSession(attemptId),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!sessionQuery.data || hydrated) return;
    const backup = readLocalBackup(attemptId);
    hydrate(sessionQuery.data, backup);
    if (
      backup &&
      Object.keys(backup).some(
        (qid) => !sessionQuery.data.answers?.[qid]
      )
    ) {
      setShowRestoredNotice(true);
    }
    if (sessionQuery.data.remainingSeconds <= 0) {
      useExamEngine.getState().setTimeUp();
    }
  }, [sessionQuery.data, hydrated, hydrate, attemptId]);

  // Not active / already submitted → go to result page.
  useEffect(() => {
    if (sessionQuery.error?.message === "ATTEMPT_NOT_ACTIVE") {
      router.replace(`/student/result/${attemptId}`);
    }
  }, [sessionQuery.error, router, attemptId]);

  // ---------------------------------------------------------------------
  // Submission
  // ---------------------------------------------------------------------
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submitExam = useCallback(async () => {
    if (useExamEngine.getState().submitting) return;
    // Flush FIRST — flushPending() no-ops while `submitting` is true.
    await flushPending().catch(() => undefined); // best effort final save
    markSubmitting();

    try {
      const res = await fetch(`/api/attempts/${attemptId}/submit`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "SUBMIT_FAILED");
      }
      setSubmitted(`/student/result/${attemptId}`);
      clearLocalBackup(attemptId);
      router.replace(`/student/result/${attemptId}`);
    } catch (err) {
      // Visible retry path: keep the user here with a clear error. The dialog
      // may not be open when this came from the timer's auto-submit — open it
      // so the failure and retry button are never silent.
      setSubmitError(err instanceof Error ? err.message : "SUBMIT_FAILED");
      setSubmitOpen(true);
      useExamEngine.setState({ submitting: false });
    }
  }, [attemptId, flushPending, markSubmitting, setSubmitted, router]);

  const remainingSeconds = useExamTimer(endsAtIso, {
    onExpire: () => void submitExam(),
  });

  // Background sync loop: drains the queue even without new interactions.
  useEffect(() => {
    const interval = setInterval(() => {
      if (useExamEngine.getState().pendingQueue.length > 0) {
        void flushPending();
      }
    }, 3000);
    const onOnline = () => void flushPending();
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
    };
  }, [flushPending]);

  useEffect(() => {
    if (timeUp && !submitting) void submitExam();
  }, [timeUp, submitting, submitExam]);

  // Warn before leaving with an active exam (except when submitting).
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!useExamEngine.getState().submitting) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Fullscreen toggle (feature-flagged)
  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } else {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch {
      // Browser refused — non-fatal.
    }
  }, []);

  // Keyboard shortcuts: ← → navigate, A–D select
  const currentQuestion = questions[currentIndex];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) {
        return;
      }
      if (e.key === "ArrowRight") goToNext();
      else if (e.key === "ArrowLeft") goToPrev();
      else if (currentQuestion) {
        const key = e.key.toUpperCase();
        if ((ANSWER_OPTIONS as readonly string[]).includes(key)) {
          selectAnswer(currentQuestion.id, key as AnswerOption);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goToNext, goToPrev, selectAnswer, currentQuestion]);

  // Deterministic option order per attempt+question (feature flag)
  const displayOrders = useMemo(() => {
    const map = new Map<string, readonly AnswerOption[]>();
    for (const q of questions) {
      map.set(q.id, FEATURES.randomOptionOrder
        ? seededShuffle(ANSWER_OPTIONS, hashSeed(`${attemptId}:${q.id}`))
        : ANSWER_OPTIONS);
    }
    return map;
  }, [questions, attemptId]);

  // ---------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------
  if (sessionQuery.isPending || !hydrated) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-muted/30">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your exam…</p>
      </div>
    );
  }

  if (sessionQuery.error && sessionQuery.error.message !== "ATTEMPT_NOT_ACTIVE") {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
        <AlertTriangle className="size-10 text-destructive" />
        <p className="text-sm text-muted-foreground">
          Could not load the exam. Please refresh the page.
        </p>
        <Button onClick={() => sessionQuery.refetch()}>Retry</Button>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const answeredCount = Object.keys(answers).length;
  const total = questions.length;
  const isWarning = remainingSeconds > 0 && remainingSeconds <= 5 * 60;
  const isCritical = remainingSeconds <= 60;
  const currentSync = syncStatuses[currentQuestion.id];
  const hasUnsaved = pendingQueue.length > 0;

  const saveIndicator =
    currentSync === "error" || hasUnsaved ? (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-foreground rounded-full bg-warning/20 px-2.5 py-1">
        <Save className="size-3" /> Saving…
      </span>
    ) : lastSyncedAt ? (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-success rounded-full bg-success/15 px-2.5 py-1">
        <CheckCircle2 className="size-3" /> Saved
      </span>
    ) : null;

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold bangla-text sm:text-base">
              {/* Exam title stored in session */}
              {(sessionQuery.data as { exam?: { title?: string } }).exam?.title}
            </h1>
            <p className="hidden text-xs text-muted-foreground sm:block">
              {answeredCount} answered · {total - answeredCount} remaining
            </p>
          </div>

          {saveIndicator}

          {FEATURES.fullScreenExamMode && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              className="max-md:hidden"
            >
              {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
            </Button>
          )}

          <Badge
            variant="outline"
            className={`gap-1.5 px-3 py-1.5 font-mono text-sm tabular-nums ${
              isCritical
                ? "animate-pulse border-destructive/50 bg-destructive/10 text-destructive"
                : isWarning
                  ? "border-warning/60 bg-warning/15 text-warning-foreground"
                  : ""
            }`}
            aria-live={isWarning ? "assertive" : "off"}
          >
            ⏱ {formatCountdown(remainingSeconds)}
          </Badge>

          <Button size="sm" onClick={() => setSubmitOpen(true)}>
            Submit
          </Button>
        </div>

        {isWarning && (
          <div className="bg-destructive/90 py-1 text-center text-xs font-medium text-white bangla-text">
            সময় কম — ৫ মিনিটেরও কম বাকি! / Less than 5 minutes left!
          </div>
        )}
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-4 px-3 py-4 sm:px-5 lg:grid-cols-[1fr_280px]">
        {/* Question column */}
        <div className="min-w-0 space-y-4">
          {showRestoredNotice && restoreNotice && (
            <Alert className="border-primary/30 bg-primary/5">
              <Save className="size-4" />
              <AlertDescription className="bangla-text">
                আগের সেশন থেকে উত্তরগুলো পুনরুদ্ধার করা হয়েছে। / Session restored.
              </AlertDescription>
            </Alert>
          )}

          <Card className="p-4 shadow-sm sm:p-6">
            <QuestionView
              index={currentIndex}
              total={total}
              question={currentQuestion}
              selected={answers[currentQuestion.id] ?? null}
              displayOrder={displayOrders.get(currentQuestion.id) ?? ANSWER_OPTIONS}
              onSelect={(answer) => selectAnswer(currentQuestion.id, answer)}
            />

            <Separator className="my-5" />

            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={goToPrev}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="size-4" /> Previous
              </Button>
              {currentIndex === total - 1 ? (
                <Button variant="secondary" onClick={() => setSubmitOpen(true)}>
                  Review & Submit
                </Button>
              ) : (
                <Button onClick={goToNext}>
                  Next <ChevronRight className="size-4" />
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Palette sidebar */}
        <aside className="lg:sticky lg:top-[4.5rem] lg:self-start">
          <Card className="p-4 shadow-sm max-lg:hidden">
            <PaletteBody
              questions={questions}
              currentIndex={currentIndex}
              answers={answers}
              onJump={setCurrent}
            />
          </Card>
          {/* Mobile palette */}
          <details className="rounded-xl border bg-card shadow-sm lg:hidden">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
              Question palette · {answeredCount}/{total}
            </summary>
            <div className="p-4 pt-0">
              <PaletteBody
                questions={questions}
                currentIndex={currentIndex}
                answers={answers}
                onJump={(i) => {
                  setCurrent(i);
                  document.querySelector("details")?.removeAttribute("open");
                }}
              />
            </div>
          </details>
        </aside>
      </main>

      {/* Submit confirmation */}
      <Dialog
        open={submitOpen}
        onOpenChange={(open) => {
          setSubmitError(null);
          setSubmitOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit your exam?</DialogTitle>
            <DialogDescription>
              You have answered{" "}
              <strong className="tabular-nums">{answeredCount}</strong> of{" "}
              <strong className="tabular-nums">{total}</strong> questions
              ({total - answeredCount} unanswered). You cannot return after
              submitting.
            </DialogDescription>
          </DialogHeader>
          {submitError && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription className="bangla-text">
                জমা দেওয়া যায়নি — আবার চেষ্টা করুন। / Submission failed, please
                try again.
                {submitError !== "SUBMIT_FAILED" && (
                  <span className="mt-1 block font-mono text-[11px] opacity-70">
                    {submitError}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSubmitOpen(false)} disabled={submitting}>
              Keep working
            </Button>
            <Button onClick={() => void submitExam()} disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {submitting ? "Submitting…" : submitError ? "Try again" : "Yes, submit now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaletteBody(props: React.ComponentProps<typeof QuestionPalette>) {
  return <QuestionPalette {...props} />;
}
