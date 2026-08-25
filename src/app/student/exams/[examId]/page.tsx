import { ArrowLeft, BookOpen, Clock, ListChecks, Sigma, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { startAttemptAction } from "@/features/student/attempts/actions";
import { requireRole } from "@/services/auth.service";
import { getExam } from "@/services/exams.service";
import { getActiveAttempt } from "@/services/student.service";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  EXAM_NOT_PUBLISHED: "This exam is not available right now.",
  NO_QUESTIONS: "This exam has no questions yet.",
  ALREADY_TAKEN: "You have already taken this exam. Retakes are disabled.",
};

export default async function ExamIntroPage({
  params,
  searchParams,
}: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireRole("student");
  const { examId } = await params;
  const { error } = await searchParams;

  const exam = await getExam(examId);
  if (!exam) notFound();

  // Resume support: surface an active attempt for this exam.
  const latest = await getActiveAttempt(user.id, examId);
  const hasActive =
    latest?.attempt.status === "in_progress" &&
    new Date(latest.attempt.ends_at).getTime() > Date.now();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/student">
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>
      </Button>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bangla-text font-normal">{exam.subject}</Badge>
            <Badge variant="secondary" className="bangla-text font-normal">{exam.category}</Badge>
          </div>
          <CardTitle className="text-xl leading-snug bangla-text sm:text-2xl">
            {exam.title}
          </CardTitle>
          <CardDescription className="bangla-text">পরীক্ষার নির্দেশনা</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Rules grid */}
          <div className="grid grid-cols-2 gap-3">
            <Rule icon={ListChecks} label="Total questions" value={`${exam.question_count}`} />
            <Rule icon={Clock} label="Duration" value={`${exam.duration_minutes} min`} />
            <Rule icon={Sigma} label="Marks per question" value={`+${Number(exam.marks_per_question)}`} />
            <Rule
              icon={TriangleAlert}
              label="Negative marking"
              value={
                Number(exam.negative_marking) > 0
                  ? `−${Number(exam.negative_marking)}`
                  : "None"
              }
              danger={Number(exam.negative_marking) > 0}
            />
          </div>

          <ul className="space-y-1.5 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground bangla-text">
            <li>• উত্তর স্বয়ংক্রিয়ভাবে সেভ হয় — রিফ্রেশ করলেও প্রগ্রেস হারাবে না।</li>
            <li>• সময় শেষ হলে পরীক্ষা স্বয়ংক্রিয়ভাবে জমা হবে।</li>
            <li>• প্রশ্ন প্যালেট থেকে যেকোনো প্রশ্নে যেতে পারবে।</li>
            <li>• জমার পর উত্তরপত্র দেখতে পাবে (সঠিক উত্তরসহ)।</li>
          </ul>

          {error && ERROR_MESSAGES[error] && (
            <Alert variant="destructive">
              <AlertDescription>{ERROR_MESSAGES[error]}</AlertDescription>
            </Alert>
          )}

          {/* Primary action */}
          <form action={startAttemptAction}>
            <input type="hidden" name="examId" value={exam.id} />
            <Button type="submit" size="lg" className="w-full bangla-text shadow-md shadow-primary/25">
              <BookOpen className="size-5" />
              {hasActive
                ? "Continue exam"
                : FEATURES_RETAKE_LABEL(Boolean(latest?.result))}
            </Button>
          </form>

          {latest?.result && !hasActive && (
            <Button asChild variant="outline" className="w-full bangla-text">
              <Link href={`/student/result/${latest.attempt.id}`}>
                View last result — {Number(latest.result.percentage)}%
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Rule({
  icon: Icon,
  label,
  value,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className={`mt-1 text-lg font-bold tabular-nums ${danger ? "text-destructive" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function FEATURES_RETAKE_LABEL(hasResult?: boolean): string {
  return hasResult ? "Retake exam" : "Start exam";
}
