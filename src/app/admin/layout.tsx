import {
  BarChart3,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { DashboardShell, type NavItem } from "@/components/dashboard-shell";
import { requireRole } from "@/services/auth.service";

const items: NavItem[] = [
  { href: "/admin", labelKey: "nav.dashboard", icon: <LayoutDashboard className="size-4" />, exact: true },
  { href: "/admin/exams", labelKey: "nav.admin.exams", icon: <FileText className="size-4" /> },
  { href: "/admin/students", labelKey: "nav.admin.students", icon: <Users className="size-4" /> },
  { href: "/admin/results", labelKey: "nav.admin.results", icon: <ClipboardCheck className="size-4" /> },
  { href: "/admin/analytics", labelKey: "nav.admin.analytics", icon: <BarChart3 className="size-4" /> },
];

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireRole("admin");
  return (
    <DashboardShell user={user} items={items}>
      {children}
    </DashboardShell>
  );
}
