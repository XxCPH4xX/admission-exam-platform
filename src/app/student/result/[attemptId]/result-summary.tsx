"use client";

import { CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface ResultSummaryData {
  attemptId: string;
  examTitle: string;
  subject: string;
  submittedAt: string | null;
  score: number;
  totalMarks: number;
  percentage: number;
  accuracy: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  totalQuestions: number;
  marksPerQuestion: number;
  negativeMarking: number;
}

/** Post-submission result card with stat tiles and review CTA. */
export function ResultSummary({ data }: { data: ResultSummaryData }) {
  return (
    <Card className="shadow-md">
      <CardHeader className="items-center pb-2 text-center">
        <div
          className={cn(
            "mx-auto mb-1 flex size-14 items-center justify-center rounded-2xl",
            Number(data.percentage) >= 60
              ? "bg-success/15 text-success"
              : "bg-warning/20 text-warning-foreground"
          )}
        >
          {Number(data.percentage) >= 60 ? (
            <CheckCircle2 className="size-8" />
          ) : (
            <MinusCircle className="size-8" />
          )}
        </div>
        <CardTitle className="text-xl sm:text-2xl bangla-text">
          {data.examTitle}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {data.submittedAt && new Date(data.submittedAt).toLocaleString()}
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Score hero */}
        <div className="rounded-2xl bg-primary/5 p-5 text-center">
          <div className="text-4xl font-extrabold tabular-nums text-primary sm:text-5xl">
            {data.score}
            <span className="text-lg font-semibold text-muted-foreground">
              {" "}
              / {data.totalMarks}
            </span>
          </div>
          <Progress value={Number(data.percentage)} className="mx-auto mt-3 h-2.5 max-w-xs" />
          <p className="mt-2 text-sm font-medium text-muted-foreground tabular-nums">
            {Number(data.percentage)}% · Accuracy {Number(data.accuracy)}%
          </p>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={MinusCircle} label="Total" value={data.totalQuestions} tone="muted" />
          <Stat icon={CheckCircle2} label="Correct" value={data.correctCount} tone="success" />
          <Stat icon={XCircle} label="Wrong" value={data.wrongCount} tone="destructive" />
          <Stat icon={MinusCircle} label="Skipped" value={data.skippedCount} tone="muted" />
        </div>

        <Separator />
        <p className="text-center text-xs text-muted-foreground tabular-nums">
          Scoring: +{data.marksPerQuestion} per correct
          {data.negativeMarking > 0 && ` · −${data.negativeMarking} per wrong`}
          {" "}· minimum score is 0
        </p>

        <Button asChild size="lg" variant="secondary" className="w-full bangla-text">
          <Link href={`/student/review/${data.attemptId}`}>Review answers</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "success" | "destructive" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <div className="rounded-xl border p-3 text-center">
      <Icon className={`mx-auto size-4 ${toneClass}`} />
      <div className={cn("mt-1 text-xl font-bold tabular-nums", toneClass)}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
