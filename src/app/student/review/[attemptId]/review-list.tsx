"use client";

import { CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReviewAnswerStatus, ReviewQuestionItem } from "@/types";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;
const LETTER_TO_FIELD = {
  A: "option_a",
  B: "option_b",
  C: "option_c",
  D: "option_d",
} as const;

type Filter = "all" | ReviewAnswerStatus;

/**
 * Detailed answer review. Green highlight = correct, red = wrong.
 * Explanations are intentionally NOT shown (platform policy).
 */
export function ReviewList({ items }: { items: ReviewQuestionItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = {
    all: items.length,
    correct: items.filter((i) => i.status === "correct").length,
    wrong: items.filter((i) => i.status === "wrong").length,
    skipped: items.filter((i) => i.status === "skipped").length,
  };

  const visible = filter === "all" ? items : items.filter((i) => i.status === filter);

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", `All (${counts.all})`],
            ["correct", `Correct (${counts.correct})`],
            ["wrong", `Wrong (${counts.wrong})`],
            ["skipped", `Skipped (${counts.skipped})`],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setFilter(key)}>
            <Badge
              variant={filter === key ? "default" : "outline"}
              className="cursor-pointer px-3 py-1.5"
            >
              {label}
            </Badge>
          </button>
        ))}
      </div>

      {visible.map(({ index, question, selectedAnswer, status }) => (
        <Card
          key={question.id}
          className={cn(
            "overflow-hidden border-l-4 shadow-sm",
            status === "correct"
              ? "border-l-success"
              : status === "wrong"
                ? "border-l-destructive"
                : "border-l-muted-foreground/30"
          )}
        >
          <div className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                Q{index + 1}
              </span>
              <StatusBadge status={status} />
            </div>

            <p className="text-sm leading-relaxed font-medium bangla-text question-text sm:text-base">
              {question.question_text}
            </p>

            {question.image_urls.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {question.image_urls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt={`Figure ${i + 1}`}
                    loading="lazy"
                    className="aspect-square w-full rounded-lg border bg-white object-contain p-1.5"
                  />
                ))}
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              {OPTION_KEYS.map((letter) => {
                const isCorrect = question.correct_answer === letter;
                const isSelected = selectedAnswer === letter;
                return (
                  <div
                    key={letter}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm bangla-text",
                      isCorrect
                        ? "border-success/60 bg-success/10 font-medium"
                        : isSelected
                          ? "border-destructive/50 bg-destructive/10"
                          : "bg-muted/40",
                      !isCorrect && !isSelected && "text-muted-foreground"
                    )}
                  >
                    <span className="mr-2 font-semibold">{letter}.</span>
                    {question[LETTER_TO_FIELD[letter]]}
                  </div>
                );
              })}
            </div>

            {/* Your answer / correct answer summary */}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs bangla-text">
              {selectedAnswer ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-medium",
                    status === "correct" ? "text-success" : "text-destructive"
                  )}
                >
                  {status === "correct" ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <XCircle className="size-3.5" />
                  )}
                  You selected: {selectedAnswer}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <MinusCircle className="size-3.5" />
                  Not answered
                </span>
              )}
              <span className="inline-flex items-center gap-1 font-medium text-success">
                <CheckCircle2 className="size-3.5" />
                Correct answer: {question.correct_answer}
              </span>
            </div>
          </div>
        </Card>
      ))}

      {visible.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nothing in this category.
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ReviewAnswerStatus }) {
  if (status === "correct") {
    return (
      <Badge className="gap-1 bg-success text-white hover:bg-success/90">
        <CheckCircle2 className="size-3" /> Correct
      </Badge>
    );
  }
  if (status === "wrong") {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="size-3" /> Wrong
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <MinusCircle className="size-3" /> Skipped
    </Badge>
  );
}
