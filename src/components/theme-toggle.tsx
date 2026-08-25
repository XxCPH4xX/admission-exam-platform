"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FEATURES } from "@/lib/features";
import { useTranslation } from "@/hooks/use-translation";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useTranslation();

  if (!FEATURES.darkMode) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          aria-label={
            resolvedTheme === "dark" ? t("nav.theme.light") : t("nav.theme.dark")
          }
        >
          <Sun className="size-4 dark:hidden" />
          <Moon className="hidden size-4 dark:block" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {resolvedTheme === "dark" ? t("nav.theme.light") : t("nav.theme.dark")}
      </TooltipContent>
    </Tooltip>
  );
}
