import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CategoryBarChart,
} from "@/components/analytics/bar-chart";
import { TrendChart } from "@/components/analytics/trend-chart";
import { requireRole } from "@/services/auth.service";
import { getStudentStats, getStudentTrend } from "@/services/student.service";

export const dynamic = "force-dynamic";

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export default async function StudentAnalyticsPage() {
  const user = await requireRole("student");
  const [trend, stats] = await Promise.all([
    getStudentTrend(user.id),
    getStudentStats(user.id),
  ]);

  const scoreData = trend.map((t) => ({ label: shortDate(t.date), value: t.percentage }));
  const accuracyData = trend.map((t) => ({ label: shortDate(t.date), value: t.accuracy }));

  // Score distribution buckets
  const buckets = [0, 0, 0, 0, 0]; // <40, 40-59, 60-69, 70-79, 80+
  for (const t of trend) {
    if (t.percentage >= 80) buckets[4]++;
    else if (t.percentage >= 70) buckets[3]++;
    else if (t.percentage >= 60) buckets[2]++;
    else if (t.percentage >= 40) buckets[1]++;
    else buckets[0]++;
  }
  const distribution = [
    { label: "<40%", value: buckets[0] },
    { label: "40–59%", value: buckets[1] },
    { label: "60–69%", value: buckets[2] },
    { label: "70–79%", value: buckets[3] },
    { label: "80%+", value: buckets[4] },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Progress analytics</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          How your scores and accuracy are moving over time.
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Exams taken", String(stats.totalExams)],
          ["Average", `${stats.averageScorePercent}%`],
          ["Highest", `${stats.highestScorePercent}%`],
          ["Lowest", `${stats.lowestScorePercent}%`],
        ].map(([label, value]) => (
          <Card key={label} className="shadow-sm">
            <CardContent className="pt-4 text-center">
              <div className="text-xl font-bold tabular-nums sm:text-2xl">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Score % per exam</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart data={scoreData} colorVar="--chart-1" />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Accuracy trend</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart data={accuracyData} colorVar="--chart-3" />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Score distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryBarChart data={distribution} colorVar="--chart-2" unit="" />
        </CardContent>
      </Card>
    </div>
  );
}
