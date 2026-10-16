/**
 * Dictionary provider. Any object exposing the same methods can replace it
 * (e.g. an API adapter): isValidGuess, isAnswer, answers, wordsWith, randomAnswer.
 */
export function createDictionary({ valid, answers }) {
  const answerList = [...new Set(answers.map((w) => w.toLowerCase()))];
  const validSet = new Set(valid.map((w) => w.toLowerCase()));
  for (const w of answerList) validSet.add(w);
  const answerSet = new Set(answerList);
  const index = new Map(); // "pos:letter" -> answer words
  for (const w of answerList) {
    for (let i = 0; i < w.length; i++) {
      const key = i + ':' + w[i];
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(w);
    }
  }
  return {
    answers: answerList,
    isValidGuess: (w) => validSet.has(String(w).toLowerCase()),
    isAnswer: (w) => answerSet.has(String(w).toLowerCase()),
    /** Eligible answers with `letter` at position `pos`. */
    wordsWith: (pos, letter) => index.get(pos + ':' + letter) || [],
    randomAnswer: (rng) => answerList[rng.int(answerList.length)],
  };
}

const parse = (t) => t.split(/\s+/).map((s) => s.trim().toLowerCase()).filter((s) => /^[a-z]{5}$/.test(s));

/** Browser loader: fetches the bundled static word lists (works offline once cached). */
export async function loadDictionary(baseUrl = new URL('../data/', import.meta.url)) {
  const [v, a] = await Promise.all(
    ['valid-guesses.txt', 'answers.txt'].map((f) =>
      fetch(new URL(f, baseUrl)).then((r) => {
        if (!r.ok) throw new Error('Failed to load ' + f);
        return r.text();
      })
    )
  );
  return createDictionary({ valid: parse(v), answers: parse(a) });
}
