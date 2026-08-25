"use client";

import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ANSWER_OPTIONS } from "@/lib/exam";
import type { QuestionRow } from "@/types";

interface Props {
  examId: string;
  question?: QuestionRow;
  onSaved: () => void;
  trigger: React.ReactNode;
}

/** Add/Edit question dialog incl. multi-image upload to Supabase Storage. */
export function QuestionFormDialog({ examId, question, onSaved, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>(question?.image_urls ?? []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;

    const remaining = 5 - imageUrls.length;
    const chosen = Array.from(files).slice(0, Math.max(0, remaining));
    if (chosen.length === 0) {
      toast.error("At most 5 images per question");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("examId", examId);
      chosen.forEach((f) => fd.append("files", f));

      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const body = await res.json();

      if (!res.ok) {
        if (body.error === "FILE_TOO_LARGE") {
          toast.error(`“${body.file}” is larger than 5 MB`);
        } else if (body.error === "UNSUPPORTED_TYPE") {
          toast.error(`“${body.file}” is not a PNG/JPG/WebP image`);
        } else if (body.error === "RATE_LIMITED") {
          toast.error("Too many uploads — wait a minute");
        } else {
          toast.error(body.error ?? "Upload failed");
        }
        return;
      }

      setImageUrls((prev) => [...prev, ...body.urls]);
      toast.success(`${body.urls.length} image(s) uploaded`);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      questionText: String(form.get("questionText") ?? ""),
      optionA: String(form.get("optionA") ?? ""),
      optionB: String(form.get("optionB") ?? ""),
      optionC: String(form.get("optionC") ?? ""),
      optionD: String(form.get("optionD") ?? ""),
      correctAnswer: String(form.get("correctAnswer") ?? ""),
      imageUrls,
    };

    // Client-side sanity checks; server actions re-validate with Zod.
    if (
      !payload.questionText ||
      !payload.optionA || !payload.optionB || !payload.optionC || !payload.optionD
    ) {
      toast.error("Question text and all four options are required");
      setPending(false);
      return;
    }

    try {
      const qs = new URLSearchParams({ examId });
      if (question) qs.set("questionId", question.id);
      const res = await fetch(`/api/admin/questions?${qs}`, {
        method: question ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      toast.success(question ? "Question updated" : "Question added");
      setOpen(false);
      setImageUrls([]);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{question ? "Edit question" : "Add question"}</DialogTitle>
          <DialogDescription className="bangla-text">
            বাংলা, English বা মিশ্র — যেভাবে খুশি লিখুন।
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`qtext-${question?.id ?? "new"}`}>Question text</Label>
            <Textarea
              id={`qtext-${question?.id ?? "new"}`}
              name="questionText"
              required
              rows={3}
              defaultValue={question?.question_text}
              placeholder="Type the question… / প্রশ্ন লিখুন…"
              className="bangla-text text-base"
              autoFocus
            />
          </div>

          {/* Options */}
          <div className="grid gap-3 sm:grid-cols-2">
            {(["A", "B", "C", "D"] as const).map((letter) => {
              const fieldMap = {
                A: "option_a",
                B: "option_b",
                C: "option_c",
                D: "option_d",
              } as const;
              const key = `option${letter}` as const;
              const defaultValue = question
                ? question[fieldMap[letter]]
                : undefined;
              return (
                <div key={letter} className="space-y-1.5">
                  <Label htmlFor={`opt-${letter}`} className="text-xs">
                    Option {letter}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`opt-${letter}`}
                      name={key}
                      required
                      defaultValue={defaultValue}
                      className="bangla-text"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Correct answer */}
          <div className="space-y-1.5">
            <Label>Correct answer</Label>
            <Select name="correctAnswer" defaultValue={question?.correct_answer ?? undefined}>
              <SelectTrigger className="w-40" aria-label="Correct answer">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {ANSWER_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    Option {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Images */}
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Images ({imageUrls.length}/5)</Label>
                <p className="text-xs text-muted-foreground bangla-text">
                  PNG, JPG বা WebP — প্রতিটি ৫ MB পর্যন্ত
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading || imageUrls.length >= 5}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImagePlus className="size-4" />
                )}
                Upload
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                hidden
                onChange={(e) => handleUpload(e.target.files)}
              />
            </div>

            {imageUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {imageUrls.map((url, i) => (
                  <div key={url} className="group relative aspect-square overflow-hidden rounded-md border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Attachment ${i + 1}`}
                      loading="lazy"
                      className="size-full object-contain"
                    />
                    <button
                      type="button"
                      aria-label="Remove image"
                      onClick={() => setImageUrls((prev) => prev.filter((u) => u !== url))}
                      className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-background/90 shadow-sm hover:bg-destructive hover:text-white"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {question ? "Save changes" : "Add question"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteQuestionButton({
  questionId,
  onDeleted,
}: {
  questionId: string;
  onDeleted: () => void;
}) {
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Delete this question?")) return;
    setPending(true);
    try {
      const res = await fetch(
        `/api/admin/questions?examId=none&questionId=${questionId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Question deleted");
      onDeleted();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 text-muted-foreground hover:text-destructive"
      onClick={handleDelete}
      disabled={pending}
      aria-label="Delete question"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </Button>
  );
}
