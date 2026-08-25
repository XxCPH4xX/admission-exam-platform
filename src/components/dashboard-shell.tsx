"use client";

import { GraduationCap, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { useTranslation } from "@/hooks/use-translation";
import type { SessionUser } from "@/types";

export interface NavItem {
  href: string;
  labelKey:
    | "nav.dashboard"
    | "nav.admin.exams"
    | "nav.admin.students"
    | "nav.admin.results"
    | "nav.admin.analytics"
    | "nav.student.exams"
    | "nav.student.history"
    | "nav.student.analytics";
  icon: ReactNode;
  exact?: boolean;
}

function NavLinks({
  items,
  onNavigate,
}: {
  items: NavItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors bangla-text ${
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {item.icon}
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardShell({
  user,
  items,
  children,
}: {
  user: SessionUser;
  items: NavItem[];
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const pathname = usePathname();

  const currentLabel =
    [...items]
      .reverse()
      .find(
        (i) => pathname === i.href || pathname.startsWith(i.href + "/")
      ) ?? items[0];

  return (
    <div className="flex min-h-svh bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar px-4 py-5 lg:flex">
        <Link href={items[0]?.href ?? "/"} className="mb-6 flex items-center gap-2.5 px-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <GraduationCap className="size-5" />
          </div>
          <span className="text-base font-bold tracking-tight bangla-text">
            {t("app.name")}
          </span>
        </Link>
        <NavLinks items={items} />
        <div className="mt-auto px-1 text-[11px] leading-relaxed text-muted-foreground">
          Admission Exam Platform
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-4">
              <SheetHeader className="px-2 pb-4 text-left">
                <SheetTitle className="flex items-center gap-2.5 text-base">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <GraduationCap className="size-4" />
                  </div>
                  <span className="bangla-text">{t("app.name")}</span>
                </SheetTitle>
              </SheetHeader>
              <NavLinks items={items} />
            </SheetContent>
          </Sheet>

          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold bangla-text sm:text-base">
            {currentLabel ? t(currentLabel.labelKey) : ""}
          </h1>

          <LanguageToggle />
          <ThemeToggle />
          <UserMenu user={user} />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
