/** Shared exam-domain constants and helpers used on both client and server. */

export const ANSWER_OPTIONS = ["A", "B", "C", "D"] as const;
export type AnswerOption = (typeof ANSWER_OPTIONS)[number];

/** Bangla letter equivalents accepted in CSV imports (ক→A খ→B গ→C ঘ→D). */
export const BANGLA_OPTION_MAP: Record<string, AnswerOption> = {
  "ক": "A",
  "খ": "B",
  "গ": "C",
  "ঘ": "D",
  "a": "A",
  "b": "B",
  "c": "C",
  "d": "D",
};

export function normalizeAnswer(raw: string): AnswerOption | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if ((ANSWER_OPTIONS as readonly string[]).includes(upper)) {
    return upper as AnswerOption;
  }
  return BANGLA_OPTION_MAP[trimmed] ?? null;
}

export function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
