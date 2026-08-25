import { requireRole } from "@/services/auth.service";
import { ExamEngine } from "./exam-engine";

export const dynamic = "force-dynamic";

export default async function ExamPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  // Engine is student-only; admins are bounced to their dashboard.
  await requireRole("student");
  const { attemptId } = await params;
  return <ExamEngine attemptId={attemptId} />;
}
