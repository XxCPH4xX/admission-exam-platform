import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryBarChart } from "@/components/analytics/bar-chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/services/auth.service";
import {
  getExamParticipation,
  getStudentPerformances,
  getSubjectStats,
} from "@/services/analytics.service";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  await requireRole("admin");

  const [subjects, participation, students] = await Promise.all([
    getSubjectStats(),
    getExamParticipation(),
    getStudentPerformances(),
  ]);

  const topStudents = [...students]
    .filter((s) => s.examsTaken > 0)
    .sort((a, b) => b.avgScorePercent - a.avgScorePercent)
    .slice(0, 10);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Analytics</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform-wide performance across subjects, exams and students.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Average accuracy by subject</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBarChart
              data={subjects.map((s) => ({ label: s.subject, value: s.avgAccuracy }))}
              colorVar="--chart-1"
            />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Attempts per exam</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBarChart
              data={participation.slice(0, 8).map((p) => ({
                label: p.title.length > 18 ? p.title.slice(0, 17) + "…" : p.title,
                value: p.attempts,
              }))}
              colorVar="--chart-2"
              unit=""
            />
          </CardContent>
        </Card>

        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Exam-wise performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Attempts</TableHead>
                    <TableHead className="text-right">Avg score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participation.map((p) => (
                    <TableRow key={p.examId}>
                      <TableCell className="max-w-64 truncate font-medium bangla-text">
                        {p.title}
                      </TableCell>
                      <TableCell className="bangla-text">{p.category}</TableCell>
                      <TableCell>
                        <Badge variant={p.published ? "default" : "secondary"}>
                          {p.published ? "Published" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.attempts}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.attempts > 0 ? `${p.avgScorePercent}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {participation.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        Not enough data yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Top students (by average score)</CardTitle>
          </CardHeader>
          <CardContent>
            {topStudents.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Not enough data yet
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-right">Exams taken</TableHead>
                      <TableHead className="text-right">Avg score</TableHead>
                      <TableHead className="text-right">Best</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topStudents.map((s, i) => (
                      <TableRow key={s.id}>
                        <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{s.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground" dir="ltr">{s.email}</TableCell>
                        <TableCell className="text-right tabular-nums">{s.examsTaken}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-primary">
                          {s.avgScorePercent}%
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{s.bestScorePercent}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
