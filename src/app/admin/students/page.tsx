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
import { getStudentPerformances } from "@/services/analytics.service";

export const dynamic = "force-dynamic";

export default async function AdminStudentsPage() {
  await requireRole("admin");
  const students = await getStudentPerformances();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Students</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Registered students and their platform performance.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="pt-0 max-md:pl-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Exams taken</TableHead>
                  <TableHead className="text-right">Avg score</TableHead>
                  <TableHead className="text-right">Best</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">{s.email}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s.examsTaken}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-primary">
                      {s.examsTaken > 0 ? `${s.avgScorePercent}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.examsTaken > 0 ? `${s.bestScorePercent}%` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {students.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No students registered yet.
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
