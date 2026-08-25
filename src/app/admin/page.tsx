import { FileText, HelpCircle, PlusCircle, Users2 } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/services/auth.service";
import {
  getAdminOverview,
  getRecentAttempts,
} from "@/services/analytics.service";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const user = await requireRole("admin");
  const [stats, recent] = await Promise.all([
    getAdminOverview(),
    getRecentAttempts(6),
  ]);

  const cards = [
    { label: "Total exams", value: stats.totalExams, icon: FileText },
    { label: "Published", value: stats.publishedExams, icon: PlusCircle },
    { label: "Questions", value: stats.totalQuestions, icon: HelpCircle },
    { label: "Exam attempts", value: stats.totalAttempts, icon: Users2 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            Welcome back, {user.name || "Admin"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of your examination platform.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/exams/new">
            <PlusCircle className="size-4" />
            Create new exam
          </Link>
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardDescription className="text-xs font-medium sm:text-sm">
                {label}
              </CardDescription>
              <Icon className="size-4 shrink-0 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums sm:text-3xl">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent attempts */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent attempts</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/results">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No attempts recorded yet. Publish an exam so students can begin.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((item) => {
                    const finished =
                      item.attempt.status !== "in_progress" && item.result;
                    return (
                      <TableRow key={item.attempt.id}>
                        <TableCell className="max-w-40 truncate font-medium">
                          {item.studentName}
                        </TableCell>
                        <TableCell className="max-w-56 truncate bangla-text">
                          {item.exam.title}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.attempt.status === "in_progress"
                                ? "secondary"
                                : "outline"
                            }
                            className="capitalize"
                          >
                            {item.attempt.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {finished
                            ? `${Number(item.result!.score)} / ${Number(
                                item.result!.correct_count +
                                  item.result!.wrong_count +
                                  item.result!.skipped_count
                              )}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
