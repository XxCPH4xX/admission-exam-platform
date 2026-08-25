import { ArrowRight, Award, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import Link from "next/link";
import { ExamCard } from "@/components/exam-card";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/services/auth.service";
import { listPublishedExams } from "@/services/exams.service";
import { getUserAttempts, getStudentStats } from "@/services/student.service";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const user = await requireRole("student");

  const [exams, stats, recent] = await Promise.all([
    listPublishedExams(),
    getStudentStats(user.id),
    getUserAttempts(user.id, 5),
  ]);

  const statCards = [
    { label: "Average score", value: `${stats.averageScorePercent}%`, icon: Trophy },
    { label: "Highest score", value: `${stats.highestScorePercent}%`, icon: TrendingUp },
    { label: "Lowest score", value: `${stats.lowestScorePercent}%`, icon: TrendingDown },
    { label: "Exams taken", value: String(stats.totalExams), icon: Award },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl bangla-text">
          স্বাগতম, {user.name || "Student"} 👋
        </h2>
        <p className="mt-1 text-sm text-muted-foreground bangla-text">
          আজকের প্রস্তুতি — আগের ফলাফলের চেয়ে ভালো করার দিন।
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardDescription className="text-xs font-medium sm:text-sm">
                {label}
              </CardDescription>
              <Icon className="size-4 shrink-0 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold tabular-nums sm:text-2xl">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent results */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent results</CardTitle>
          <Link
            href="/student/history"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View all
            <ArrowRight className="size-3.5" />
          </Link>
        </CardHeader>
        <CardContent>
          {recent.filter((r) => r.result).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground bangla-text">
              Take your first exam to see results here.
            </p>
          ) : (
            <ul className="divide-y">
              {recent
                .filter((r) => r.result)
                .slice(0, 4)
                .map(({ attempt, exam, result }) => (
                  <li key={attempt.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link
                        href={`/student/result/${attempt.id}`}
                        className="line-clamp-1 text-sm font-medium hover:text-primary hover:underline bangla-text"
                      >
                        {exam.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {new Date(attempt.started_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant={Number(result!.percentage) >= 60 ? "default" : "secondary"}
                      className="shrink-0 tabular-nums"
                    >
                      {Number(result!.percentage)}%
                    </Badge>
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Available exams */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Available exams</h3>
          <Link
            href="/student/exams"
            className="text-sm font-medium text-primary hover:underline"
          >
            All exams →
          </Link>
        </div>

        {exams.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="py-10 text-center text-sm text-muted-foreground bangla-text">
              No published exams yet — check back soon!
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {exams.slice(0, 6).map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                ctaHref={`/student/exams/${exam.id}`}
                ctaLabel="Start exam"
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
