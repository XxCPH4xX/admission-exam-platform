import { Eye, EyeOff, Pencil, PlusCircle } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExamRowActions } from "@/features/admin/exams/exam-row-actions";
import { requireRole } from "@/services/auth.service";
import { listExams } from "@/services/exams.service";

export const dynamic = "force-dynamic";

export default async function AdminExamsPage() {
  await requireRole("admin");
  const exams = await listExams();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Exams</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, publish and manage mock tests.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/exams/new">
            <PlusCircle className="size-4" />
            New exam
          </Link>
        </Button>
      </div>

      {exams.length === 0 ? (
        <Card className="shadow-sm">
          <CardHeader className="items-center pt-10 text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <PlusCircle className="size-6" />
            </div>
            <CardTitle>No exams yet</CardTitle>
            <CardDescription>Create your first exam to get started.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-10">
            <Button asChild>
              <Link href="/admin/exams/new">Create exam</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {exams.map((exam) => (
            <Card
              key={exam.id}
              className="group flex flex-col shadow-sm transition-shadow hover:shadow-md"
            >
              <CardHeader className="pb-2">
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge
                    variant={exam.published ? "default" : "secondary"}
                    className="gap-1"
                  >
                    {exam.published ? (
                      <Eye className="size-3" />
                    ) : (
                      <EyeOff className="size-3" />
                    )}
                    {exam.published ? "Published" : "Draft"}
                  </Badge>
                  <Badge variant="outline" className="font-normal bangla-text">
                    {exam.subject}
                  </Badge>
                </div>
                <CardTitle className="text-base leading-snug bangla-text">
                  <Link
                    href={`/admin/exams/${exam.id}`}
                    className="hover:text-primary hover:underline"
                  >
                    {exam.title}
                  </Link>
                </CardTitle>
                <CardDescription className="bangla-text">{exam.category}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{exam.question_count} questions</span>
                  <span>{exam.duration_minutes} min</span>
                  <span>+{Number(exam.marks_per_question)} / question</span>
                  {Number(exam.negative_marking) > 0 && (
                    <span className="text-destructive">
                      −{Number(exam.negative_marking)} negative
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <Button asChild variant="ghost" size="sm" className="h-8">
                    <Link href={`/admin/exams/${exam.id}`}>
                      <Pencil className="size-3.5" />
                      Manage
                    </Link>
                  </Button>
                  <ExamRowActions exam={exam} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
