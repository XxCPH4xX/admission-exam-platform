"use client";

import {
  BarChart3,
  ClipboardCheck,
  GraduationCap,
  Languages,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTranslation } from "@/hooks/use-translation";

const features = [
  { icon: Timer, key: "exams" },
  { icon: ClipboardCheck, key: "results" },
  { icon: BarChart3, key: "analytics" },
  { icon: Languages, key: "bangla" },
] as const;

export default function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-svh flex-col bg-gradient-to-b from-primary/5 via-background to-background">
      {/* Nav */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <GraduationCap className="size-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            {t("app.name")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
          <Button asChild variant="outline" size="sm" className="ml-1">
            <Link href="/login">{t("auth.loginButton")}</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-4 pt-12 pb-20 text-center sm:px-6 sm:pt-20">
        <Badge variant="secondary" className="mb-5 px-3 py-1 text-xs bangla-text">
          {t("landing.hero.badge")}
        </Badge>
        <h1 className="max-w-2xl text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-5xl sm:leading-[1.15] bangla-text">
          {t("landing.hero.title")}
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg bangla-text">
          {t("landing.hero.subtitle")}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="min-w-44 shadow-md shadow-primary/25">
            <Link href="/login">{t("landing.cta.student")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="min-w-44">
            <Link href="/login">{t("landing.cta.admin")}</Link>
          </Button>
        </div>

        {/* Features */}
        <div className="mt-16 grid w-full max-w-4xl grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, key }) => (
            <Card
              key={key}
              className="border-border/60 bg-card/80 shadow-sm backdrop-blur transition-shadow hover:shadow-md"
            >
              <CardHeader className="pb-2">
                <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <CardTitle className="text-base bangla-text">
                  {t(`landing.features.${key}.title`)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed bangla-text">
                  {t(`landing.features.${key}.body`)}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © Admission Exam Platform — ভর্তি প্রস্তুতি প্ল্যাটফর্ম
      </footer>
    </div>
  );
}
