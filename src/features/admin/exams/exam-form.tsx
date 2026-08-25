"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createExamAction, updateExamAction } from "@/features/admin/exams/actions";
import type { ExamSummary } from "@/types";

interface Props {
  /** Present → edit mode; absent → create mode. */
  exam?: ExamSummary;
}

export function ExamForm({ exam }: Props) {
  const router = useRouter();
  const isEdit = Boolean(exam);

  const [state, formAction, pending] = useActionState(
    isEdit ? updateExamAction : createExamAction,
    { status: "idle" }
  );

  const [published, setPublished] = useState(exam?.published ?? false);

  useEffect(() => {
    if (state.status === "success") {
      if (isEdit) {
        toast.success("Exam updated");
      } else {
        // Create mode: state.message carries the new exam id.
        router.push(`/admin/exams/${state.message}`);
      }
    } else if (state.status === "error") {
      toast.error(state.message ?? "Failed to save");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function fieldError(name: string): string | undefined {
    return state.fieldErrors?.[name]?.[0];
  }

  return (
    <form action={formAction} className="space-y-5">
      {exam && <input type="hidden" name="examId" value={exam.id} />}
      {exam && <input type="hidden" name="published" value={String(published)} />}

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          defaultValue={exam?.title}
          placeholder="e.g. Medical Admission Mock Test 01"
          className="bangla-text"
          aria-invalid={Boolean(fieldError("title"))}
        />
        {fieldError("title") && (
          <p className="text-xs text-destructive">{fieldError("title")}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            name="subject"
            required
            defaultValue={exam?.subject}
            placeholder="e.g. Biology"
            className="bangla-text"
            aria-invalid={Boolean(fieldError("subject"))}
          />
          {fieldError("subject") && (
            <p className="text-xs text-destructive">{fieldError("subject")}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            name="category"
            required
            defaultValue={exam?.category}
            placeholder="e.g. Medical Admission / BUET / GST"
            className="bangla-text"
            aria-invalid={Boolean(fieldError("category"))}
          />
          {fieldError("category") && (
            <p className="text-xs text-destructive">{fieldError("category")}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="durationMinutes">Duration (minutes)</Label>
          <Input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min={1}
            max={600}
            step={1}
            required
            defaultValue={exam?.duration_minutes ?? 30}
          />
          {fieldError("durationMinutes") && (
            <p className="text-xs text-destructive">{fieldError("durationMinutes")}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="marksPerQuestion">Marks per question</Label>
          <Input
            id="marksPerQuestion"
            name="marksPerQuestion"
            type="number"
            min={0.25}
            max={100}
            step={0.25}
            required
            defaultValue={Number(exam?.marks_per_question ?? 1)}
          />
          {fieldError("marksPerQuestion") && (
            <p className="text-xs text-destructive">{fieldError("marksPerQuestion")}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="negativeMarking">Negative per wrong</Label>
          <Input
            id="negativeMarking"
            name="negativeMarking"
            type="number"
            min={0}
            max={100}
            step={0.25}
            required
            defaultValue={Number(exam?.negative_marking ?? 0.25)}
          />
          <p className="text-xs text-muted-foreground">Set 0 to disable</p>
          {fieldError("negativeMarking") && (
            <p className="text-xs text-destructive">{fieldError("negativeMarking")}</p>
          )}
        </div>
      </div>

      {isEdit && (
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor="published" className="cursor-pointer">Published</Label>
            <p className="text-xs text-muted-foreground">
              Students can only see published exams.
            </p>
          </div>
          <Switch
            id="published"
            checked={published}
            onCheckedChange={setPublished}
          />
        </div>
      )}

      <Button type="submit" disabled={pending} className="min-w-36">
        {pending && <Loader2 className="size-4 animate-spin" />}
        {isEdit ? "Save changes" : "Create exam"}
      </Button>
    </form>
  );
}
