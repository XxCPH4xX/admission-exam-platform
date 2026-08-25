import { ArrowLeft, Home } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/services/auth.service";
import { getAttemptReview } from "@/services/student.service";
import { ResultSummary } from "./result-summary";

export const dynamic = "force-dynamic";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const user = await requireRole("student");
  const { attemptId } = await params;
  const review = await getAttemptReview(user.id, attemptId);

  if (!review) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/student/history">
            <ArrowLeft className="size-4" />
            My results
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/student">
            <Home className="size-4" />
            Dashboard
          </Link>
        </Button>
      </div>

      <ResultSummary
        data={{
          attemptId: review.attemptId,
          examTitle: review.examTitle,
          subject: review.subject,
          submittedAt: review.submittedAt,
          score: Number(review.result.score),
          totalMarks:
            Number(review.result.correct_count + review.result.wrong_count + review.result.skipped_count) *
            Number(review.marksPerQuestion),
          percentage: Number(review.result.percentage),
          accuracy: Number(review.result.accuracy),
          correctCount: review.result.correct_count,
          wrongCount: review.result.wrong_count,
          skippedCount: review.result.skipped_count,
          totalQuestions:
            review.result.correct_count +
            review.result.wrong_count +
            review.result.skipped_count,
          marksPerQuestion: Number(review.marksPerQuestion),
          negativeMarking: Number(review.negativeMarking),
        }}
      />
    </div>
  );
}
