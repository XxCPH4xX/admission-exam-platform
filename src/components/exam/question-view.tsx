"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnswerOption, SafeQuestion } from "@/types";

const OPTION_LABELS: Record<AnswerOption, string> = {
  A: "ক",
  B: "খ",
  C: "গ",
  D: "ঘ",
};

/**
 * Renders one exam question: text (Bangla/English/mixed), optional images
 * and the four single-correct MCQ options.
 *
 * `displayOrder` controls option order on screen; selection always stores
 * the REAL letter so shuffling can't corrupt saved answers.
 */
export function QuestionView({
  index,
  total,
  question,
  selected,
  displayOrder,
  onSelect,
}: {
  index: number;
  total: number;
  question: SafeQuestion;
  selected: AnswerOption | null;
  displayOrder: readonly AnswerOption[];
  onSelect: (answer: AnswerOption | null) => void;
}) {
  const optionText: Record<AnswerOption, string> = {
    A: question.option_a,
    B: question.option_b,
    C: question.option_c,
    D: question.option_d,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-baseline gap-3">
        <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-semibold tabular-nums text-primary">
          Q{index + 1}
        </span>
        <span className="text-xs font-medium text-muted-foreground sm:text-sm">
          Question {index + 1} of {total} / প্রশ্ন {index + 1}/{total}
        </span>
      </div>

      {/* Question text */}
      <p className="question-text bangla-text font-medium">{question.question_text}</p>

      {/* Supporting images */}
      {question.image_urls.length > 0 && (
        <div className="flex flex-col gap-3">
          {question.image_urls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={`Question ${index + 1} figure ${i + 1}`}
              loading="lazy"
              className="max-h-96 w-full max-w-xl self-center rounded-xl border bg-white object-contain p-2 shadow-sm"
            />
          ))}
        </div>
      )}

      {/* Options */}
      <div
        role="radiogroup"
        aria-label={`Question ${index + 1} options`}
        className="grid gap-2.5"
      >
        {displayOrder.map((letter) => {
          const isSelected = selected === letter;
          return (
            <button
              key={letter}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(isSelected ? null : letter)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all bangla-text",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                isSelected
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "bg-card hover:border-primary/40 hover:bg-muted/60 active:scale-[0.995]"
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted text-muted-foreground group-hover:border-primary/40"
                )}
                aria-hidden
              >
                {isSelected ? <Check className="size-4" /> : OPTION_LABELS[letter]}
              </span>
              <span className="min-w-0 flex-1 text-[0.95rem] leading-relaxed sm:text-base">
                {optionText[letter]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
