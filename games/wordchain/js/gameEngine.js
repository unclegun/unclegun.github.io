import { CrosswordBoard, CrosswordGenerator } from './crosswordGenerator.js';
import { evaluateGuess, CORRECT } from './wordleEvaluator.js';
import { WORD_LENGTH, cellsOf, key, validatePlacement } from './placementValidator.js';
import { createRng } from './random.js';

export const MAX_ATTEMPTS = 6;
export const WORD_POINTS = 100;
export const ATTEMPT_BONUS = 10; // per unused attempt

export const scoreFor = (attempts) => WORD_POINTS + (MAX_ATTEMPTS - attempts) * ATTEMPT_BONUS;

/**
 * Rules and progression. phases: 'guessing' -> 'solved' (awaiting advance())
 * -> 'guessing' ...; status: 'playing' | 'lost' | 'complete'.
 */
export class GameEngine {
  constructor({ dictionary, seed = Date.now(), state = null }) {
    this.dictionary = dictionary;
    this.rng = createRng(seed);
    this.generator = new CrosswordGenerator({ dictionary, rng: this.rng });
    this.board = new CrosswordBoard();
    this.next = null; // precomputed candidates
    if (state) {
      this.#restore(state);
      // A save taken mid-transition (solved, not yet advanced) resumes at the next word.
      if (this.phase === 'solved' && this.status === 'playing') this.advance();
    } else this.#start(seed);
  }

  #start(seed) {
    this.seed = seed;
    this.score = 0;
    this.solved = 0;
    this.status = 'playing';
    this.phase = 'guessing';
    this.guesses = [];
    this.current = this.generator.firstWord();
  }

  get attemptsLeft() { return MAX_ATTEMPTS - this.guesses.length; }
  get wordNumber() { return this.solved + (this.phase === 'solved' || this.status !== 'playing' ? 0 : 1); }

  /** Locked crossing letters of the current word: { index: letter }. */
  get locked() {
    const out = {};
    if (!this.current) return out;
    for (const c of cellsOf(this.current.word, this.current.x, this.current.y, this.current.dir)) {
      const cell = this.board.cells.get(key(c.x, c.y));
      if (cell) out[c.i] = cell.letter;
    }
    return out;
  }

  /** Validates a guess without consuming an attempt. Returns an error string or null. */
  checkGuess(guess) {
    if (this.status !== 'playing' || this.phase !== 'guessing') return 'Not accepting guesses';
    const g = String(guess).toLowerCase();
    if (g.length !== WORD_LENGTH || !/^[a-z]+$/.test(g)) return 'Not enough letters';
    for (const [i, l] of Object.entries(this.locked)) if (g[i] !== l) return 'Locked letters must be kept';
    if (!this.dictionary.isValidGuess(g)) return 'Not in word list';
    return null;
  }

  submitGuess(guess) {
    const error = this.checkGuess(guess);
    if (error) return { ok: false, error };
    const word = guess.toLowerCase();
    const result = evaluateGuess(word, this.current.word);
    this.guesses.push({ word, result });
    if (result.every((r) => r === CORRECT)) {
      this.score += scoreFor(this.guesses.length);
      this.solved++;
      this.board.addWord(this.current.word, this.current.x, this.current.y, this.current.dir);
      this.phase = 'solved';
      return { ok: true, result, solved: true };
    }
    if (this.guesses.length >= MAX_ATTEMPTS) {
      this.status = 'lost';
      return { ok: true, result, solved: false, lost: true, answer: this.current.word };
    }
    return { ok: true, result, solved: false };
  }

  /** Moves from 'solved' to the next round, or completes the run if no placement exists. */
  advance() {
    if (this.phase !== 'solved' || this.status !== 'playing') return null;
    const next = this.#takeNext();
    this.guesses = [];
    if (!next) {
      this.status = 'complete';
      this.current = null;
      this.phase = 'guessing';
      return null;
    }
    this.current = next;
    this.phase = 'guessing';
    return next;
  }

  /**
   * Precompute upcoming placements using a projected board containing the
   * current target (known before it is solved). Safe to call any time.
   */
  precompute() {
    if (!this.current || this.phase !== 'guessing') return;
    const projected = this.board.clone();
    projected.addWord(this.current.word, this.current.x, this.current.y, this.current.dir);
    this.next = { forWord: this.current.word, candidates: this.generator.findCandidates(projected, 4, { wordNumber: this.solved + 2 }) };
  }

  #takeNext() {
    const wordNumber = this.solved + 1;
    const cached = this.next && this.next.forWord === this.current.word ? this.next.candidates : [];
    this.next = null;
    const fresh = cached.filter((c) => this.#stillValid(c));
    if (fresh.length) return fresh[this.rng.int(Math.min(fresh.length, 3))];
    return this.generator.pickNext(this.board, wordNumber); // on-demand fallback
  }

  #stillValid(c) {
    return !this.board.has(c.word) && validatePlacement(this.board, c.word, c.x, c.y, c.dir).ok;
  }

  toJSON() {
    return {
      version: 1,
      seed: this.seed,
      rng: this.rng.getState(),
      score: this.score,
      solved: this.solved,
      status: this.status,
      phase: this.phase,
      guesses: this.guesses,
      current: this.current,
      words: this.board.words,
    };
  }

  #restore(s) {
    this.seed = s.seed;
    this.score = s.score;
    this.solved = s.solved;
    this.status = s.status;
    this.phase = s.phase;
    this.guesses = s.guesses;
    this.current = s.current;
    for (const w of s.words) this.board.addWord(w.word, w.x, w.y, w.dir);
    this.rng.setState(s.rng);
  }
}
