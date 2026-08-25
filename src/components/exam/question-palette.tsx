"use client";

import { cn } from "@/lib/utils";
import type { AnswerOption, SafeQuestion } from "@/types";

/**
 * Question palette: green = answered, gray = not answered, blue = current.
 * Click any number to jump. Grid reflows for mobile/tablet/desktop.
 */
export function QuestionPalette({
  questions,
  currentIndex,
  answers,
  onJump,
}: {
  questions: SafeQuestion[];
  currentIndex: number;
  answers: Record<string, AnswerOption>;
  onJump: (index: number) => void;
}) {
  const total = questions.length;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-5">
        {questions.map((q, i) => {
          const isAnswered = answers[q.id] !== undefined;
          const isCurrent = i === currentIndex;

          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onJump(i)}
              aria-label={`Go to question ${i + 1}`}
              aria-current={isCurrent ? "true" : undefined}
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg border text-sm font-semibold tabular-nums transition-all",
                "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                isCurrent
                  ? "scale-105 border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : isAnswered
                    ? "border-success/60 bg-success/15 text-success hover:bg-success/25"
                    : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <LegendItem colorClass="bg-success/70" label="Answered" />
        <LegendItem colorClass="bg-muted-foreground/40 border border-border" label="Not answered" />
        <LegendItem colorClass="bg-primary" label="Current" />
        <span className="ml-auto tabular-nums font-medium">
          {answeredCount}/{total}
        </span>
      </div>
    </div>
  );
}

function LegendItem({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-3 rounded-sm", colorClass)} aria-hidden />
      {label}
    </span>
  );
}
