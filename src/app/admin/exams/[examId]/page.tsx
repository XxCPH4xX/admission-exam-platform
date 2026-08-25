import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImportPanelWithRefresh } from "@/features/admin/import/import-panel";
import { ExamForm } from "@/features/admin/exams/exam-form";
import { QuestionManager } from "@/features/admin/questions/question-manager";
import { requireRole } from "@/services/auth.service";
import { getExam } from "@/services/exams.service";

export const dynamic = "force-dynamic";

export default async function ExamDetailPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  await requireRole("admin");
  const { examId } = await params;
  const exam = await getExam(examId);

  if (!exam) notFound();

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/exams">
          <ArrowLeft className="size-4" />
          Back to exams
        </Link>
      </Button>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold tracking-tight bangla-text sm:text-2xl">
          {exam.title}
        </h2>
        <Badge variant={exam.published ? "default" : "secondary"}>
          {exam.published ? "Published" : "Draft"}
        </Badge>
      </div>

      <Tabs defaultValue="questions" className="gap-4">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="questions">Questions ({exam.question_count})</TabsTrigger>
          <TabsTrigger value="import">Import CSV/XLSX</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="questions">
          <QuestionManager examId={exam.id} />
        </TabsContent>

        <TabsContent value="import">
          <ImportPanelWithRefresh examId={exam.id} />
        </TabsContent>

        <TabsContent value="settings">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Exam settings</CardTitle>
            </CardHeader>
            <CardContent>
              <ExamForm exam={exam} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
