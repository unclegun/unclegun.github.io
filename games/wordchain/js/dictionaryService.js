/**
 * Dictionary provider. Any object exposing the same methods can replace it
 * (e.g. an API adapter): isValidGuess, isAnswer, answers, wordsWith, randomAnswer.
 * Words are grouped by length; the default length (5) keeps the original API unchanged.
 * Extra lengths (4, 6, 7 for Wildcard) are added with `extend`.
 */
export const DEFAULT_LENGTH = 5;

export function createDictionary({ valid = [], answers = [] }) {
  const groups = new Map(); // length -> { valid:Set, answers:[], answerSet:Set, index:Map("pos:letter" -> words) }

  const group = (len) => {
    if (!groups.has(len)) groups.set(len, { valid: new Set(), answers: [], answerSet: new Set(), index: new Map() });
    return groups.get(len);
  };

  const extend = ({ valid: v = [], answers: a = [] }) => {
    for (const raw of v) {
      const w = String(raw).toLowerCase();
      if (/^[a-z]+$/.test(w)) group(w.length).valid.add(w);
    }
    for (const raw of a) {
      const w = String(raw).toLowerCase();
      if (!/^[a-z]+$/.test(w)) continue;
      const g = group(w.length);
      if (g.answerSet.has(w)) continue;
      g.answerSet.add(w);
      g.answers.push(w);
      g.valid.add(w);
      for (let i = 0; i < w.length; i++) {
        const k = i + ':' + w[i];
        if (!g.index.has(k)) g.index.set(k, []);
        g.index.get(k).push(w);
      }
    }
  };
  extend({ valid, answers });
  group(DEFAULT_LENGTH);

  return {
    extend,
    get answers() { return group(DEFAULT_LENGTH).answers; },
    lengths: () => [...groups.entries()].filter(([, g]) => g.answers.length).map(([n]) => n).sort((a, b) => a - b),
    hasLength: (n) => !!groups.get(n)?.answers.length,
    answersOf: (len = DEFAULT_LENGTH) => group(len).answers,
    isValidGuess: (w) => { const s = String(w).toLowerCase(); return group(s.length).valid.has(s); },
    isAnswer: (w) => { const s = String(w).toLowerCase(); return group(s.length).answerSet.has(s); },
    /** Eligible answers of the given length with `letter` at position `pos`. */
    wordsWith: (pos, letter, len = DEFAULT_LENGTH) => group(len).index.get(pos + ':' + letter) || [],
    randomAnswer: (rng, len = DEFAULT_LENGTH) => { const a = group(len).answers; return a[rng.int(a.length)]; },
  };
}

const parse = (t, len) => t.split(/\s+/).map((s) => s.trim().toLowerCase()).filter((s) => s.length === len && /^[a-z]+$/.test(s));

const fileNames = (len) => (len === DEFAULT_LENGTH ? ['valid-guesses.txt', 'answers.txt'] : [`valid-guesses-${len}.txt`, `answers-${len}.txt`]);

const fetchText = (baseUrl, f) =>
  fetch(new URL(f, baseUrl)).then((r) => {
    if (!r.ok) throw new Error('Failed to load ' + f);
    return r.text();
  });

/** Loads word lists of the given lengths into `dictionary` (skips lengths already present). */
export async function loadLengths(dictionary, lengths, baseUrl = new URL('../data/', import.meta.url)) {
  for (const len of lengths) {
    if (dictionary.hasLength(len)) continue;
    const [v, a] = await Promise.all(fileNames(len).map((f) => fetchText(baseUrl, f)));
    dictionary.extend({ valid: parse(v, len), answers: parse(a, len) });
  }
  return dictionary;
}

/** Browser loader: fetches the bundled static word lists (works offline once cached). */
export async function loadDictionary(baseUrl = new URL('../data/', import.meta.url), lengths = [DEFAULT_LENGTH]) {
  const dictionary = createDictionary({});
  return loadLengths(dictionary, lengths, baseUrl);
}
