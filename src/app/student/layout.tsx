import {
  BarChart3,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
} from "lucide-react";
import type { ReactNode } from "react";
import { DashboardShell, type NavItem } from "@/components/dashboard-shell";
import { requireRole } from "@/services/auth.service";

const items: NavItem[] = [
  { href: "/student", labelKey: "nav.dashboard", icon: <LayoutDashboard className="size-4" />, exact: true },
  { href: "/student/exams", labelKey: "nav.student.exams", icon: <FileText className="size-4" /> },
  { href: "/student/history", labelKey: "nav.student.history", icon: <ClipboardCheck className="size-4" /> },
  { href: "/student/analytics", labelKey: "nav.student.analytics", icon: <BarChart3 className="size-4" /> },
];

export default async function StudentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireRole("student");
  return (
    <DashboardShell user={user} items={items}>
      {children}
    </DashboardShell>
  );
}
