import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/services/auth.service";
import { getUserAttempts } from "@/services/student.service";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await requireRole("student");
  const attempts = await getUserAttempts(user.id, 100, true);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">My results</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every exam you have completed, with score and accuracy.
        </p>
      </div>

      {attempts.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ClipboardCheck className="size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No completed exams yet.
            </p>
            <Button asChild size="sm">
              <Link href="/student/exams">Browse exams</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Percent</TableHead>
                    <TableHead className="text-right">Accuracy</TableHead>
                    <TableHead className="text-right">Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.map(({ attempt, exam, result }) => (
                    <TableRow key={attempt.id}>
                      <TableCell className="max-w-64 truncate font-medium bangla-text">
                        {exam.title}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(attempt.started_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {result ? `${Number(result.score)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {result ? (
                          <Badge
                            variant={Number(result.percentage) >= 60 ? "default" : "secondary"}
                          >
                            {Number(result.percentage)}%
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {result ? `${Number(result.accuracy)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                          <Link href={`/student/result/${attempt.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
