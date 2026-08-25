"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteExamAction,
  togglePublishAction,
} from "@/features/admin/exams/actions";
import { useTranslation } from "@/hooks/use-translation";
import type { ExamSummary } from "@/types";

export function ExamRowActions({ exam }: { exam: ExamSummary }) {
  const { t } = useTranslation();
  const [, deleteAction] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      await deleteExamAction(formData);
      return null;
    },
    null
  );

  return (
    <div className="flex items-center justify-end gap-1">
      {/* Publish / Unpublish */}
      <form action={togglePublishAction}>
        <input type="hidden" name="examId" value={exam.id} />
        <input type="hidden" name="published" value={String(!exam.published)} />
        <Button
          type="submit"
          size="sm"
          variant={exam.published ? "outline" : "default"}
          className="h-8"
        >
          {exam.published ? t("exam.unpublish") : t("exam.publish")}
        </Button>
      </form>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            variant="destructive"
            onClick={(e) => {
              if (
                !window.confirm(
                  `Delete “${exam.title}”?\n\nAll its questions, attempts and results will be permanently removed.`
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <form action={deleteAction} className="w-full">
              <input type="hidden" name="examId" value={exam.id} />
              <button type="submit" className="flex w-full cursor-pointer items-center gap-2">
                <Trash2 className="size-4" />
                Delete
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
