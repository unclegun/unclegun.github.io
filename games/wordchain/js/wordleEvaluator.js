export const CORRECT = 'correct';
export const PRESENT = 'present';
export const ABSENT = 'absent';

/** Standard Wordle scoring with correct duplicate-letter handling. */
export function evaluateGuess(guess, answer) {
  const g = guess.toLowerCase();
  const a = answer.toLowerCase();
  const result = new Array(g.length).fill(ABSENT);
  const remaining = {};
  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) result[i] = CORRECT;
    else remaining[a[i]] = (remaining[a[i]] || 0) + 1;
  }
  for (let i = 0; i < g.length; i++) {
    if (result[i] === CORRECT) continue;
    if (remaining[g[i]] > 0) {
      result[i] = PRESENT;
      remaining[g[i]]--;
    }
  }
  return result;
}

const RANK = { [ABSENT]: 0, [PRESENT]: 1, [CORRECT]: 2 };

/** Best known status per letter across a list of {word, result} guesses. */
export function letterStatuses(guesses) {
  const out = {};
  for (const { word, result } of guesses) {
    for (let i = 0; i < word.length; i++) {
      const c = word[i];
      if (!(c in out) || RANK[result[i]] > RANK[out[c]]) out[c] = result[i];
    }
  }
  return out;
}
