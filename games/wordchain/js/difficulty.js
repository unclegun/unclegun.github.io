/**
 * Placement preferences by word number (1-based). These are soft preferences used
 * for scoring, never hard constraints: any valid placement may still be chosen.
 * Returns { min, max } preferred crossing counts, or null for the first word.
 */
export function crossingPreference(wordNumber) {
  if (wordNumber <= 1) return null;
  if (wordNumber <= 5) return { min: 1, max: 1 };
  if (wordNumber <= 15) return { min: 1, max: 2 };
  return { min: 1, max: 3 };
}
