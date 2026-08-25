"use client";

import { useMutation } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, FileUp, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ParsedImport } from "@/validations/import";

type ParseResponse = ParsedImport & { ok: true };

/** Wrapper that refreshes server components (question counts) after import. */
export function ImportPanelWithRefresh({ examId }: { examId: string }) {
  const router = useRouter();
  return <ImportPanel examId={examId} onImported={() => router.refresh()} />;
}

/** Upload → server-side parse/validate → preview table → confirm import. */
export function ImportPanel({
  examId,
  onImported,
}: {
  examId: string;
  onImported: () => void;
}) {
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const parseMutation = useMutation({
    mutationFn: async (file: File): Promise<ParseResponse> => {
      if (file.size > 10 * 1024 * 1024) throw new Error("FILE_TOO_LARGE");
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/api/admin/import?examId=${examId}`, {
        method: "POST",
        body: fd,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      return body;
    },
    onSuccess: (data) => {
      setParsed(data);
      if (data.errors.length === 0 && data.rows.length > 0) {
        toast.success(`${data.rows.length} valid row(s)`);
      }
    },
    onError: (err: Error) => {
      const messages: Record<string, string> = {
        FILE_TOO_LARGE: "File is larger than 10 MB",
        UNSUPPORTED_TYPE: "Unsupported file — use .csv or .xlsx",
        READ_FAILED: "Could not read the file. Ensure UTF-8 CSV or XLSX.",
        NO_ROWS: "The file has no data rows",
      };
      toast.error(messages[err.message] ?? err.message);
    },
  });

  const importMutation = useMutation({
    mutationFn: async (): Promise<{ inserted: number }> => {
      // Parsed rows use the import shape (`question`, `imageUrl`); the bulk
      // endpoint validates against questionCreateSchema (`questionText`,
      // `imageUrls[]`) — map before sending.
      const payload = parsed!.rows.map((row) => ({
        questionText: row.question,
        optionA: row.optionA,
        optionB: row.optionB,
        optionC: row.optionC,
        optionD: row.optionD,
        correctAnswer: row.correctAnswer,
        imageUrls: row.imageUrl ? [row.imageUrl] : [],
      }));
      const res = await fetch(`/api/admin/questions?examId=${examId}&bulk=true`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        const at = typeof body.row === "number" ? ` (row ${body.row + 1})` : "";
        throw new Error(`${body.error ?? `HTTP ${res.status}`}${at}`);
      }
      return body;
    },
    onSuccess: ({ inserted }) => {
      toast.success(`Imported ${inserted} question(s)`);
      setParsed(null);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      onImported();
    },
    onError: (err: Error) => toast.error(`Import failed: ${err.message}`),
  });

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Import questions</CardTitle>
        <CardDescription className="bangla-text">
          UTF-8 CSV বা XLSX আপলোড করুন — কলাম: Question, Option A–D, Correct
          Answer (A–D বা ক–ঘ), Image URL (ঐচ্ছিক)। Import-এর আগে প্রিভিউ দেখা যাবে।
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Step 1 — choose & validate */}
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              setParsed(null);
              if (!file) return;
              setFileName(file.name);
              parseMutation.mutate(file);
            }}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={parseMutation.isPending}
            className="min-w-44"
          >
            {parseMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileUp className="size-4" />
            )}
            Choose CSV or XLSX
          </Button>
          {fileName && (
            <span className="truncate text-sm text-muted-foreground">
              {parseMutation.isPending ? `Validating ${fileName}…` : fileName}
            </span>
          )}
        </div>

        {/* Step 2 — validation summary */}
        {parsed && (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="default" className="gap-1 bg-success text-white hover:bg-success/90">
                <CheckCircle2 className="size-3.5" />
                {parsed.rows.length} valid
              </Badge>
              {parsed.errors.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="size-3.5" />
                  {parsed.errors.length} with errors
                </Badge>
              )}
            </div>

            {/* Preview table */}
            {parsed.rows.length > 0 && (
              <div className="max-h-96 overflow-auto rounded-lg border palette-scroll">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead className="min-w-64">Question</TableHead>
                      <TableHead>A</TableHead>
                      <TableHead>B</TableHead>
                      <TableHead>C</TableHead>
                      <TableHead>D</TableHead>
                      <TableHead>Ans</TableHead>
                      <TableHead>Image</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.rows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {i + 1}
                        </TableCell>
                        <TableCell className="bangla-text">{row.question}</TableCell>
                        <TableCell className="max-w-40 truncate bangla-text">{row.optionA}</TableCell>
                        <TableCell className="max-w-40 truncate bangla-text">{row.optionB}</TableCell>
                        <TableCell className="max-w-40 truncate bangla-text">{row.optionC}</TableCell>
                        <TableCell className="max-w-40 truncate bangla-text">{row.optionD}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{row.correctAnswer}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.imageUrl ? "🖼" : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Error rows */}
            {parsed.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>
                  <ul className="list-inside list-disc space-y-1 text-xs">
                    {parsed.errors.slice(0, 8).map((e) => (
                      <li key={e.rowNumber} className="bangla-text">
                        Row {e.rowNumber}: {e.errors.join("; ")}
                      </li>
                    ))}
                    {parsed.errors.length > 8 && (
                      <li>…and {parsed.errors.length - 8} more</li>
                    )}
                  </ul>
                  Only valid rows will be imported.
                </AlertDescription>
              </Alert>
            )}

            {/* Step 3 — confirm */}
            <Button
              onClick={() => importMutation.mutate()}
              disabled={parsed.rows.length === 0 || importMutation.isPending}
              size="lg"
              className="min-w-56"
            >
              {importMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Import {parsed.rows.length} question(s)
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
