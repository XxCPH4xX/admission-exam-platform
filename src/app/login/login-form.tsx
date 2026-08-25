"use client";

import { useActionState } from "react";
import { AlertCircle, Loader2, LogIn } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { loginAction } from "@/features/auth/actions";
import { useTranslation } from "@/hooks/use-translation";

export function LoginForm({ next }: { next?: string }) {
  const { t } = useTranslation();
  const [state, formAction, pending] = useActionState(loginAction, {
    status: "idle",
  });

  return (
    <div className="relative flex min-h-svh items-center justify-center bg-gradient-to-b from-primary/5 via-background to-background p-4">
      <div className="absolute top-4 right-4 flex items-center gap-1">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md shadow-lg shadow-primary/5">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
            <LogIn className="size-6" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {t("auth.login.title")}
          </CardTitle>
          <CardDescription>{t("auth.login.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="next" value={next ?? ""} />

            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                dir="ltr"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                dir="ltr"
              />
            </div>

            {state.status === "error" && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>
                  {state.message === "INVALID_CREDENTIALS"
                    ? t("auth.invalidCredentials")
                    : (state.message ?? t("auth.loginError"))}
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("auth.loggingIn")}
                </>
              ) : (
                t("auth.loginButton")
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
