import { crossingPreference } from './difficulty.js';

/**
 * Mode-specific progression, keyed by `mode.progression`. Preferences are soft: they bias
 * which valid placements are offered, never force obscure words or impossible placements.
 * Every rule takes the 1-based number of the word being placed.
 */
const RULES = {
  classic: {
    crossingPreference,
    lengthsFor: () => [5],
  },
  builder: {
    // Early rounds: one crossing. Later rounds welcome multi-crossing shapes.
    crossingPreference: (n) => (n <= 1 ? null : n <= 4 ? { min: 1, max: 1 } : n <= 10 ? { min: 1, max: 2 } : { min: 1, max: 3 }),
    maxCrossings: (n) => (n <= 3 ? 1 : n <= 8 ? 2 : 4), // hard cap while candidates exist (relaxed if none)
    lengthsFor: () => [5],
  },
  architect: {
    crossingPreference: (n) => (n <= 1 ? null : n <= 3 ? { min: 1, max: 1 } : { min: 2, max: 3 }),
    maxCrossings: (n) => (n <= 3 ? 1 : 4),
    lengthsFor: () => [5],
  },
  wildcard: {
    crossingPreference: (n) => (n <= 1 ? null : n <= 5 ? { min: 1, max: 1 } : { min: 1, max: 2 }),
    /** Allowed answer lengths, introduced gradually: 5 first, then 4/6, then 7. */
    lengthsFor: (n) => (n <= 2 ? [5] : n <= 5 ? [4, 5, 6] : [4, 5, 6, 7]),
    /** Preferred length order for the next word (weighted shuffle of allowed lengths). */
    lengthOrder(n, rng) {
      const allowed = this.lengthsFor(n);
      const weights = allowed.map((l) => (l === 5 ? 3 : l === 7 ? 1 : 2));
      const out = [];
      const pool = allowed.map((l, i) => ({ l, w: weights[i] }));
      while (pool.length) {
        const total = pool.reduce((s, p) => s + p.w, 0);
        let r = rng.next() * total;
        let i = 0;
        while (i < pool.length - 1 && (r -= pool[i].w) >= 0) i++;
        out.push(pool.splice(i, 1)[0].l);
      }
      return out;
    },
  },
  anarchy: {
    crossingPreference: (n) => (n <= 1 ? null : n <= 3 ? { min: 1, max: 1 } : { min: 1, max: 2 }),
    // Ordinary rounds use five letters; other lengths arrive through Wildcard Round and Boss events (forcedLengths).
    lengthsFor: () => [5],
  },
};

export const getRules = (mode) => {
  const base = RULES[mode.progression] || RULES.classic;
  return {
    crossingPreference: base.crossingPreference,
    maxCrossings: base.maxCrossings || (() => Infinity),
    lengthsFor: (n) => base.lengthsFor(n),
    lengthOrder: (n, rng) => (base.lengthOrder ? base.lengthOrder(n, rng) : base.lengthsFor(n)),
  };
};
