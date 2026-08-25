import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExamForm } from "@/features/admin/exams/exam-form";
import { requireRole } from "@/services/auth.service";

export default async function NewExamPage() {
  await requireRole("admin");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/exams">
          <ArrowLeft className="size-4" />
          Back to exams
        </Link>
      </Button>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">New exam</CardTitle>
          <CardDescription>
            Set the exam rules. You can add questions and publish afterwards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExamForm />
        </CardContent>
      </Card>
    </div>
  );
}
