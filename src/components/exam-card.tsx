import { Clock, FileQuestion } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ExamSummary } from "@/types";

/** Student-facing exam card with a start/continue CTA. */
export function ExamCard({
  exam,
  ctaHref,
  ctaLabel,
  badge,
}: {
  exam: ExamSummary;
  ctaHref: string;
  ctaLabel: string;
  badge?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-normal bangla-text">
            {exam.subject}
          </Badge>
          <Badge variant="secondary" className="font-normal bangla-text">
            {exam.category}
          </Badge>
          {badge}
        </div>
        <CardTitle className="text-base leading-snug bangla-text">{exam.title}</CardTitle>
      </CardHeader>

      <CardContent className="mt-auto space-y-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <FileQuestion className="size-3.5" />
            {exam.question_count} questions
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            {exam.duration_minutes} min
          </span>
        </div>
        <Button asChild size="sm" className="w-full sm:w-auto">
          <Link href={ctaHref} className="bangla-text">
            {ctaLabel}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
