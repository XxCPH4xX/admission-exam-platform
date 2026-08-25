"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, PlusCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DeleteQuestionButton,
  QuestionFormDialog,
} from "@/features/admin/questions/question-form-dialog";
import type { QuestionRow, SafeQuestion } from "@/types";

async function fetchQuestions(examId: string): Promise<QuestionRow[]> {
  const res = await fetch(`/api/admin/questions?examId=${examId}`);
  if (!res.ok) throw new Error("Failed to load questions");
  const body = await res.json();
  return body.questions as QuestionRow[];
}

/** Admin question bank for one exam: list + add/edit/delete + reordering. */
export function QuestionManager({ examId }: { examId: string }) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const {
    data: questions,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["admin-questions", examId],
    queryFn: () => fetchQuestions(examId),
  });

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">Questions</CardTitle>
          <CardDescription>
            {questions
              ? `${questions.length} question(s) in this exam`
              : "Loading…"}
          </CardDescription>
        </div>
        <QuestionFormDialog
          examId={examId}
          onSaved={() => refetch()}
          trigger={
            <Button size="sm">
              <PlusCircle className="size-4" />
              Add question
            </Button>
          }
        />
      </CardHeader>

      <CardContent className="space-y-2">
        {isLoading && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Failed to load questions.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {questions?.length === 0 && !isRefetching && (
          <div className="rounded-lg border border-dashed py-10 text-center">
            <p className="text-sm text-muted-foreground bangla-text">
              এখনও কোনো প্রশ্ন নেই — প্রথম প্রশ্নটি যোগ করুন বা CSV/XLSX ইমপোর্ট করুন।
            </p>
          </div>
        )}

        {questions?.map((q, index) => {
          const open = openIds.has(q.id);
          const options = [
            { letter: "A", text: q.option_a },
            { letter: "B", text: q.option_b },
            { letter: "C", text: q.option_c },
            { letter: "D", text: q.option_d },
          ] as const;

          return (
            <div
              key={q.id}
              className="rounded-lg border bg-card transition-colors"
            >
              <div className="flex items-start gap-3 p-3">
                <Badge variant="secondary" className="mt-0.5 shrink-0 tabular-nums">
                  {index + 1}
                </Badge>

                <button
                  type="button"
                  onClick={() => toggleOpen(q.id)}
                  aria-expanded={open}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="line-clamp-2 text-sm leading-relaxed font-medium bangla-text question-text sm:text-[0.95rem]">
                    {q.question_text}
                  </p>
                  <span className="mt-1 inline-block text-xs text-muted-foreground">
                    Correct: {q.correct_answer}
                    {q.image_urls.length > 0 && ` · ${q.image_urls.length} image(s)`}
                  </span>
                </button>

                <div className="flex shrink-0 items-center gap-0.5">
                  <QuestionFormDialog
                    examId={examId}
                    question={q}
                    onSaved={() => refetch()}
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                      >
                        Edit
                      </Button>
                    }
                  />
                  <DeleteQuestionButton questionId={q.id} onDeleted={() => refetch()} />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => toggleOpen(q.id)}
                    aria-label={open ? "Collapse" : "Expand"}
                  >
                    {open ? (
                      <ChevronUp className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              {open && (
                <div className="space-y-3 border-t px-3 pt-3 pb-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {options.map((opt) => (
                      <div
                        key={opt.letter}
                        className={`rounded-md border px-3 py-2 text-sm bangla-text ${
                          q.correct_answer === opt.letter
                            ? "border-success/50 bg-success/10"
                            : "bg-muted/40"
                        }`}
                      >
                        <span className="mr-2 font-semibold">{opt.letter}.</span>
                        {opt.text}
                      </div>
                    ))}
                  </div>

                  {q.image_urls.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {q.image_urls.map((url, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={url}
                          src={url}
                          alt={`Question ${index + 1} image ${i + 1}`}
                          loading="lazy"
                          className="aspect-square w-full rounded-md border object-contain bg-white"
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export type { SafeQuestion };
