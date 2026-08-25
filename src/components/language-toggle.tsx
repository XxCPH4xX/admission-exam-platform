"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/hooks/use-translation";
import { useDocumentLang } from "@/hooks/use-translation";

/** Toggles the entire UI between English and Bangla. */
export function LanguageToggle() {
  const { t, locale, toggleLocale } = useTranslation();
  useDocumentLang(locale);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLocale}
          className="gap-1.5 px-2.5 font-semibold"
          aria-label={t("common.language")}
        >
          <Languages className="size-4" />
          <span className={locale === "en" ? "bangla-text" : ""}>
            {locale === "en" ? "বাংলা" : "EN"}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("nav.toggleLanguage")}</TooltipContent>
    </Tooltip>
  );
}
