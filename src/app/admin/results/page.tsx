import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/services/auth.service";
import { getAllCompletedAttempts } from "@/services/analytics.service";

export const dynamic = "force-dynamic";

export default async function AdminResultsPage() {
  await requireRole("admin");
  const attempts = await getAllCompletedAttempts(200);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">All attempts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every exam attempt across the platform.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Exam</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Correct</TableHead>
                  <TableHead className="text-right">Wrong</TableHead>
                  <TableHead className="text-right">Skipped</TableHead>
                  <TableHead className="text-right">Score %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((item) => {
                  const done = item.attempt.status !== "in_progress" && item.result;
                  return (
                    <TableRow key={item.attempt.id}>
                      <TableCell className="max-w-40 truncate font-medium">
                        {item.studentName}
                      </TableCell>
                      <TableCell className="max-w-56 truncate bangla-text">
                        {item.exam.title}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(item.attempt.started_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.attempt.status === "in_progress"
                              ? "secondary"
                              : item.attempt.status === "expired"
                                ? "outline"
                                : "default"
                          }
                          className="capitalize"
                        >
                          {item.attempt.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-success">
                        {done ? item.result!.correct_count : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">
                        {done ? item.result!.wrong_count : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {done ? item.result!.skipped_count : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {done ? `${Number(item.result!.percentage)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {attempts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No attempts recorded yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
