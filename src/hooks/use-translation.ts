"use client";

import { useCallback, useEffect } from "react";
import {
  translate,
  useLanguageStore,
  type Locale,
  type TranslateFn,
} from "@/lib/i18n";

/**
 * React hook for UI strings:
 *   const { t, locale, setLocale } = useTranslation();
 *   t("exam.duration", { minutes: 30 }) // "30 min" / "৩০ মিনিট"
 */
export function useTranslation() {
  const locale = useLanguageStore((s) => s.locale);
  const setLocale = useLanguageStore((s) => s.setLocale);
  const toggleLocale = useLanguageStore((s) => s.toggleLocale);

  const t = useCallback<TranslateFn>(
    (key, vars) => translate(locale, key, vars),
    [locale]
  );

  return { t, locale, setLocale, toggleLocale };
}

/** Apply `lang` attribute on <html> so CSS Bangla typography rules engage. */
export function useDocumentLang(locale: Locale) {
  useEffect(() => {
    document.documentElement.lang = locale === "bn" ? "bn" : "en";
  }, [locale]);
}
