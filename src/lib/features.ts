/**
 * Platform feature flags.
 *
 * Single source of truth for optional capabilities. Toggling a flag here
 * enables/disables the feature across the UI and API without code changes.
 * (When multi-tenant scale arrives, these can move to a `feature_flags` table
 * cached per-request — the read sites stay the same.)
 */
export const FEATURES = {
  /** Allow users to switch between light/dark themes. */
  darkMode: true,
  /** Shuffle question order per attempt (order is persisted per attempt). */
  randomQuestionOrder: true,
  /** Shuffle option order deterministically per attempt+question. */
  randomOptionOrder: false,
  /** Allow students to retake an exam after completing it. */
  retakeExam: true,
  /** Offer distraction-free fullscreen during exams. */
  fullScreenExamMode: true,
  /** Show the student leaderboard page. */
  leaderboard: false,
  /** Allow multiple simultaneous students beyond the initial seed user. */
  multiStudentExpansion: true,
} as const;

export type FeatureKey = keyof typeof FEATURES;

export function isFeatureEnabled(key: FeatureKey): boolean {
  return FEATURES[key];
}
