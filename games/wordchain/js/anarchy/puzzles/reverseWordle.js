import { evaluateGuess } from '../../wordleEvaluator.js';
import { shuffle } from '../../random.js';

const consistent = (answer, clues) => clues.every((c) => evaluateGuess(c.word, answer).join() === c.result.join());

/** Answers (from the dictionary's answer list) that agree with every clue. */
export const candidatesFor = (dictionary, length, clues) => dictionary.answersOf(length).filter((a) => consistent(a, clues));

/**
 * Reverse Wordle: instead of guessing, the player sees a few Wordle guesses with their feedback and must deduce
 * the one answer that explains all of them. Clues are generated against the real answer so they are always
 * consistent; generation adds clues until a single answer remains (or the clue cap is reached).
 */
export class ReverseWordle {
  constructor({ answer, clues, attempts = 3, tries = [] }) {
    this.type = 'reverse';
    this.answer = answer;
    this.clues = clues;
    this.attempts = attempts;
    this.tries = tries;
  }

  static create({ dictionary, answer, rng, maxClues = 6 }) {
    const len = answer.length;
    const pool = shuffle(dictionary.answersOf(len).filter((w) => w !== answer), rng).slice(0, 260);
    const clues = [];
    let cands = dictionary.answersOf(len).slice();
    while (cands.length > 1 && clues.length < maxClues) {
      let best = null;
      for (const w of pool.slice(0, 80)) {
        const result = evaluateGuess(w, answer);
        if (result.every((r) => r === 'absent') && clues.length > 0) continue;
        const left = cands.filter((a) => evaluateGuess(w, a).join() === result.join()).length;
        if (!best || left < best.left) best = { word: w, result, left };
      }
      if (!best || best.left >= cands.length) break;
      clues.push({ word: best.word, result: best.result });
      cands = cands.filter((a) => evaluateGuess(best.word, a).join() === best.result.join());
      pool.splice(pool.findIndex((p) => p === best.word), 1);
    }
    return new ReverseWordle({ answer, clues });
  }

  /** Submit a deduction. Any word consistent with all clues counts (the answer is guaranteed to be consistent). */
  submit(word, dictionary) {
    if (this.attemptsLeft <= 0 || this.solved) return { ok: false, error: 'No attempts left' };
    if (!dictionary.isValidGuess(word) || word.length !== this.answer.length) return { ok: false, error: 'Not in word list' };
    this.tries.push(word);
    const right = word === this.answer || consistent(word, this.clues);
    if (right) this.solved = true;
    return { ok: true, correct: right };
  }

  get attemptsLeft() { return this.attempts - this.tries.length; }
  get failed() { return !this.solved && this.attemptsLeft <= 0; }
  isSolved() { return !!this.solved; }

  toJSON() { return { type: this.type, answer: this.answer, clues: this.clues.map((c) => ({ word: c.word, result: c.result.slice() })), attempts: this.attempts, tries: this.tries.slice(), solved: !!this.solved }; }

  static fromJSON(j) {
    if (!j || typeof j.answer !== 'string' || !Array.isArray(j.clues) || !j.clues.length) return null;
    if (!j.clues.every((c) => c && typeof c.word === 'string' && c.word.length === j.answer.length && Array.isArray(c.result))) return null;
    if (!consistent(j.answer, j.clues)) return null;
    const p = new ReverseWordle({ answer: j.answer, clues: j.clues, attempts: 3, tries: Array.isArray(j.tries) ? j.tries.filter((t) => typeof t === 'string').slice(0, 3) : [] });
    p.solved = !!j.solved;
    return p;
  }
}
