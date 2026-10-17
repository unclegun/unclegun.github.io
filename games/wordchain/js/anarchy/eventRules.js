/**
 * Pure rules shared by modifiers, events and the director: attempt budgets, fairness floors and compatibility.
 * Nothing here touches the DOM.
 */
export const MAX_NORMAL_ATTEMPTS = 6;

/** Number of dictionary answers that fit the revealed letters ({ index: letter }). */
export function viableCount(dictionary, length, locked) {
  const entries = Object.entries(locked);
  if (!entries.length) return dictionary.answersOf(length).length;
  let pool = null;
  for (const [i, l] of entries) {
    const list = dictionary.wordsWith(Number(i), l, length);
    if (!pool || list.length < pool.length) pool = list;
  }
  return pool.filter((w) => entries.every(([i, l]) => w[i] === l)).length;
}

/**
 * Smallest attempt budget that is still a fair puzzle for the number of viable answers.
 * Many viable answers need more attempts to narrow down; very few viable answers can be played with two.
 */
export function fairFloor(viable) {
  if (viable >= 60) return 4;
  if (viable >= 8) return 3;
  return 2;
}

/** Pressure Cooker balance table: 0 known -> 6, 1 -> 5, 2 -> 3, 3+ -> 2, then never below the fairness floor. */
export function pressureAttempts(known, viable = 0) {
  const table = known <= 0 ? 6 : known === 1 ? 5 : known === 2 ? 3 : 2;
  return Math.min(MAX_NORMAL_ATTEMPTS, Math.max(table, fairFloor(viable)));
}

/** Applies the fairness floor to a requested budget. */
export const clampAttempts = (wanted, viable) => Math.min(MAX_NORMAL_ATTEMPTS + 3, Math.max(wanted, fairFloor(viable)));

/**
 * Compatibility between two catalogue definitions.
 * Rules: explicit incompatibility lists; only one board mutation at a time; encounters run alone;
 * a mini-game or puzzle never overlaps another unresolved interaction (handled by the game phase machine).
 */
export function compatible(a, b) {
  if (a.id === b.id) return false;
  if ((a.incompatible || []).includes(b.id) || (b.incompatible || []).includes(a.id)) return false;
  if (a.mutation && b.mutation) return false;
  if (a.kind === 'encounter' || b.kind === 'encounter') return false;
  if (a.kind === 'interlude' && b.kind === 'interlude') return false;
  return true;
}
