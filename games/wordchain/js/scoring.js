/**
 * Scoring strategies. Pure functions: (strategy id, word context) -> { total, items[] }.
 * Weights live in SCORING so they are configurable and testable; every point shows up as a labelled item.
 *
 * ctx: { attempts, baseAttempts, length, known, analysis, density }
 *   known    - letters the player did not have to guess (crossings + hints)
 *   analysis - analyzePlacement() result for the placement (null for the first word)
 *   density  - filled cells / bounding-box area after placing the word
 */
export const SCORING = {
  classic: { word: 100, attempt: 10 },
  builder: { word: 100, attempt: 10, unknown: 5, intersection: 15, expand: 10, connect: 20, junction: 40 },
  architect: { word: 50, attempt: 5, intersection: 25, connect: 20, junction: 60, compact: 20, linear: -15, density: 30 },
  challenge: { word: 100, attempt: 10 },
  wildcard: { perLetter: 20, attempt: 10, unknown: 5 },
};

const unusedAttempts = (c) => Math.max(0, c.baseAttempts - c.attempts);
const item = (label, points) => ({ label, points });

const STRATEGIES = {
  classic: (c, w) => [item('Word solved', w.word), item(`Unused tries (${unusedAttempts(c)})`, unusedAttempts(c) * w.attempt)],

  builder: (c, w) => {
    const a = c.analysis;
    const unknown = Math.max(0, c.length - c.known);
    const items = [
      item('Word solved', w.word),
      item(`Efficiency (${unusedAttempts(c)} unused)`, unusedAttempts(c) * w.attempt),
      item(`Unknown letters (${unknown})`, unknown * w.unknown),
    ];
    if (a) {
      if (a.crossings > 1) items.push(item(`Extra intersections (${a.crossings - 1})`, (a.crossings - 1) * w.intersection));
      items.push(item(`${a.category[0].toUpperCase()}${a.category.slice(1)} placement`, w[a.category]));
    }
    return items;
  },

  architect: (c, w) => {
    const a = c.analysis;
    const items = [item('Word solved', w.word), item(`Efficiency (${unusedAttempts(c)} unused)`, unusedAttempts(c) * w.attempt)];
    if (!a) return items;
    if (a.crossings) items.push(item(`Intersections (${a.crossings})`, a.crossings * w.intersection));
    if (a.category === 'junction') items.push(item('Junction', w.junction));
    else if (a.category === 'connect') items.push(item('Connected branches', w.connect));
    if (a.bonuses.compact) items.push(item('Compact: no board growth', w.compact));
    items.push(item(`Density (${Math.round(c.density * 100)}%)`, Math.round(c.density * w.density)));
    if (a.linear) items.push(item('Linear expansion', w.linear));
    return items;
  },

  wildcard: (c, w) => {
    const unknown = Math.max(0, c.length - c.known);
    return [
      item(`${c.length}-letter word`, c.length * w.perLetter),
      item(`Efficiency (${unusedAttempts(c)} unused)`, unusedAttempts(c) * w.attempt),
      item(`Unknown letters (${unknown})`, unknown * w.unknown),
    ];
  },
};
STRATEGIES.challenge = STRATEGIES.classic;

export function scoreWord(strategy, ctx, weights = SCORING[strategy]) {
  const items = STRATEGIES[strategy](ctx, weights);
  const total = Math.max(0, items.reduce((s, i) => s + i.points, 0));
  return { total, items };
}

/** Classic scoring helper kept for the original API. */
export const classicScore = (attempts, base = 6) => scoreWord('classic', { attempts, baseAttempts: base }).total;
