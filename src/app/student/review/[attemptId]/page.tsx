import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/services/auth.service";
import { getAttemptReview } from "@/services/student.service";
import { ReviewList } from "./review-list";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const user = await requireRole("student");
  const { attemptId } = await params;
  const review = await getAttemptReview(user.id, attemptId);

  if (!review) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/student/result/${attemptId}`}>
            <ArrowLeft className="size-4" />
            Result
          </Link>
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="bangla-text">Answer review</CardTitle>
          <CardDescription className="bangla-text">
            {review.examTitle} — সঠিক উত্তর সবুজ, ভুল উত্তর লাল।
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-lg bg-success/10 py-2">
            <span className="font-bold tabular-nums text-success">
              {review.result.correct_count}
            </span>{" "}
            correct
          </div>
          <div className="rounded-lg bg-destructive/10 py-2">
            <span className="font-bold tabular-nums text-destructive">
              {review.result.wrong_count}
            </span>{" "}
            wrong
          </div>
          <div className="rounded-lg bg-muted py-2">
            <span className="font-bold tabular-nums">
              {review.result.skipped_count}
            </span>{" "}
            skipped
          </div>
        </CardContent>
      </Card>

      <ReviewList items={review.items} />
    </div>
  );
}
