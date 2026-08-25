import { ExamCard } from "@/components/exam-card";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { requireRole } from "@/services/auth.service";
import { listPublishedExams } from "@/services/exams.service";
import { getActiveAttemptId } from "@/services/attempts.service";

export const dynamic = "force-dynamic";

export default async function StudentExamListPage() {
  const user = await requireRole("student");
  const exams = await listPublishedExams();

  // Flag exams the student can resume.
  const activeIds = await Promise.all(
    exams.map((e) => getActiveAttemptId(user.id, e.id))
  );
  const activeSet = new Set(activeIds.filter(Boolean) as string[]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">All exams</h2>
        <p className="mt-1 text-sm text-muted-foreground bangla-text">
          সব প্রকাশিত পরীক্ষা — যেকোনো সময় শুরু করুন।
        </p>
      </div>

      {exams.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-12 text-center text-sm text-muted-foreground bangla-text">
            No published exams yet — check back soon!
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {exams.map((exam) => (
            <ExamCard
              key={exam.id}
              exam={exam}
              ctaHref={`/student/exams/${exam.id}`}
              ctaLabel={activeSet.has(exam.id) ? "Continue exam" : "Start exam"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
