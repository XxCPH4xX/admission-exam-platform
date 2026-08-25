/**
 * PostgREST one-to-one embed normalization.
 *
 * When an embedded resource's FK column carries a UNIQUE constraint (as
 * `results.attempt_id` does), PostgREST detects a one-to-one relationship
 * and returns a single OBJECT (or null) instead of an array. Depending on
 * server version/config this can also come back as an array, so every
 * consumer must be shape-agnostic or it crashes/reads undefined.
 */

/** First row of an embedded relation, whether it arrived as object or array. */
export function embedFirst<T>(embed: T | T[] | null | undefined): T | null {
  if (embed == null) return null;
  return Array.isArray(embed) ? ((embed[0] as T | undefined) ?? null) : (embed as T);
}

/**
 * Type guard variant for pipelines: filters nulls while narrowing.
 */
export function hasEmbed<T>(embed: T | T[] | null | undefined): embed is T {
  return embedFirst(embed) !== null;
}
