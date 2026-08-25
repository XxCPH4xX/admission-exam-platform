"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { en, type TranslationKey } from "./en";
import { bn } from "./bn";

export type Locale = "en" | "bn";

const dictionaries: Record<Locale, Record<TranslationKey, string>> = {
  en,
  bn,
};

interface LanguageState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

/** Persisted language preference (SSR-safe: defaults to English pre-hydration). */
export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      locale: "en",
      setLocale: (locale) => set({ locale }),
      toggleLocale: () => set({ locale: get().locale === "en" ? "bn" : "en" }),
    }),
    { name: "language-preference" }
  )
);

export type TranslateFn = (
  key: TranslationKey,
  vars?: Record<string, string | number>
) => string;

export type { TranslationKey };

/**
 * Resolve a UI string for the given locale with `{var}` interpolation.
 * Falls back to English when a Bangla string is missing.
 */
export function translate(
  locale: Locale,
  key: TranslationKey,
  vars?: Record<string, string | number>
): string {
  let text: string = dictionaries[locale][key] ?? en[key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}
