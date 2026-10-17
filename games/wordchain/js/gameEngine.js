import { CrosswordBoard, CrosswordGenerator, analyzePlacement, publicOption, footprintId } from './crosswordGenerator.js';
import { evaluateGuess, CORRECT } from './wordleEvaluator.js';
import { WORD_LENGTH, cellsOf, key, validatePlacement } from './placementValidator.js';
import { createRng } from './random.js';
import { getMode, BASE_ATTEMPTS } from './gameModes.js';
import { getRules } from './modeRules.js';
import { scoreWord } from './scoring.js';
import { ResourceManager } from './resourceManager.js';
import { ChallengeManager } from './challengeManager.js';

export const MAX_ATTEMPTS = BASE_ATTEMPTS;
export const WORD_POINTS = 100;
export const ATTEMPT_BONUS = 10; // per unused attempt

export const scoreFor = (attempts) => WORD_POINTS + (MAX_ATTEMPTS - attempts) * ATTEMPT_BONUS;

const toCandidate = (board, o) => {
  const c = { word: o.word, x: o.x, y: o.y, dir: o.dir, anchor: null, score: 0 };
  return { ...c, id: footprintId(c), ...analyzePlacement(board, c) };
};

/**
 * Shared rules engine for every mode (behaviour is driven by the mode config, see gameModes.js).
 * phases: 'guessing' -> 'solved' (awaiting advance()) -> 'guessing', or -> 'choosing' (selection modes:
 * pick one of the offered placements with choose()) -> 'guessing'.
 * status: 'playing' | 'lost' | 'complete'.
 */
export class GameEngine {
  constructor({ dictionary, seed = Date.now(), state = null, mode = 'classic' }) {
    this.dictionary = dictionary;
    this.mode = typeof mode === 'string' ? getMode(mode) : mode;
    if (state && state.mode) this.mode = getMode(state.mode);
    if (!this.mode) throw new Error('Unknown mode');
    this.rules = getRules(this.mode);
    this.rng = createRng(seed);
    this.generator = new CrosswordGenerator({ dictionary, rng: this.rng });
    this.board = new CrosswordBoard();
    this.next = null; // precomputed candidates (Classic)
    this.resources = this.mode.features.tokens ? new ResourceManager(this.mode.tokens) : null;
    this.challenges = this.mode.features.challenges ? new ChallengeManager() : null;
    this.options = null; // candidate placements offered while phase === 'choosing' (contain hidden words)
    this.rejected = new Set();
    this.lastBreakdown = null;
    // Hooks used by composed subsystems (Anarchy); inert (null) for every other mode.
    this.attemptLimit = null; // overrides mode.attempts for the current word
    this.queued = null; // placement to use for the next word (must still be valid)
    this.forcedLengths = null; // restricts the next word's length (variable-length modes)
    if (state) {
      this.#restore(state);
      // A save taken mid-transition (solved, not yet advanced) resumes at the next word.
      if (this.phase === 'solved' && this.status === 'playing' && !this.mode.features.anarchy) this.advance();
    } else this.#start(seed);
  }

  #start(seed) {
    this.seed = seed;
    this.score = 0;
    this.solved = 0;
    this.status = 'playing';
    this.phase = 'guessing';
    this.history = [];
    this.#beginWord();
    this.current = this.generator.firstWord(this.rules.lengthsFor(1)[0]);
    if (this.challenges) this.#refreshObjective(1);
  }

  #beginWord() {
    this.guesses = [];
    this.hints = {};
    this.extra = 0;
    this.attemptLimit = null;
    this.resources?.resetWord();
  }

  get maxAttempts() { return (this.attemptLimit ?? this.mode.attempts) + this.extra; }
  get attemptsLeft() { return this.maxAttempts - this.guesses.length; }
  get wordLength() { return this.current ? this.current.word.length : WORD_LENGTH; }
  get wordNumber() { return this.solved + (this.phase !== 'guessing' || this.status !== 'playing' ? 0 : 1); }

  /** Locked crossing letters of the current word: { index: letter }. */
  get crossingLocked() {
    const out = {};
    if (!this.current) return out;
    for (const c of cellsOf(this.current.word, this.current.x, this.current.y, this.current.dir)) {
      const cell = this.board.cells.get(key(c.x, c.y));
      if (cell) out[c.i] = cell.letter;
    }
    return out;
  }

  /** Locked letters: crossing letters plus hint-revealed letters. { index: letter } */
  get locked() {
    return { ...this.crossingLocked, ...this.hints };
  }

  /** Options for the selection UI. The hidden target words are never included. */
  get publicOptions() { return this.options ? this.options.map(publicOption) : []; }

  /** Validates a guess without consuming an attempt. Returns an error string or null. */
  checkGuess(guess) {
    if (this.status !== 'playing' || this.phase !== 'guessing') return 'Not accepting guesses';
    const g = String(guess).toLowerCase();
    if (g.length !== this.current.word.length || !/^[a-z]+$/.test(g)) return 'Not enough letters';
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
      const breakdown = this.#settle();
      this.phase = 'solved';
      return { ok: true, result, solved: true, breakdown };
    }
    if (this.guesses.length >= this.maxAttempts) {
      this.status = 'lost';
      return { ok: true, result, solved: false, lost: true, answer: this.current.word };
    }
    return { ok: true, result, solved: false };
  }

  /** Scores the solved word, pays token/objective rewards and places the word on the board. */
  #settle() {
    const cur = this.current;
    const analysis = this.board.words.length ? analyzePlacement(this.board, cur) : null;
    const hints = Object.keys(this.hints).length;
    this.board.addWord(cur.word, cur.x, cur.y, cur.dir);
    const b = this.board.bounds();
    const density = this.board.cells.size / ((b.maxX - b.minX + 1) * (b.maxY - b.minY + 1));
    const attempts = this.guesses.length;
    const { total, items } = scoreWord(this.mode.scoring, {
      attempts, baseAttempts: this.mode.attempts, length: cur.word.length,
      known: (analysis?.crossings || 0) + hints, analysis, density,
    });
    this.score += total;
    this.solved++;
    const breakdown = { items: items.slice(), total, tokens: 0, objective: null };
    if (this.resources) {
      const earn = this.mode.tokens.earn;
      let t = 0;
      if (attempts <= earn.efficientMaxAttempts && !hints && !this.extra) t += this.resources.award(`w${this.solved}:efficient`, earn.efficient);
      if (analysis && analysis.crossings >= 2) t += this.resources.award(`w${this.solved}:cross`, earn.multiIntersection);
      breakdown.tokens = t;
    }
    if (this.challenges) {
      const event = { attempts, crossings: analysis?.crossings || 0, category: analysis?.category || null, dir: cur.dir, hints, extra: this.extra, wordScore: total };
      const { completed } = this.challenges.record(event, { solved: this.solved, score: this.score });
      if (completed) {
        this.score += completed.reward.score;
        breakdown.items.push({ label: `Objective: ${completed.text}`, points: completed.reward.score });
        breakdown.total += completed.reward.score;
        breakdown.objective = { text: completed.text, score: completed.reward.score, tokens: completed.reward.tokens };
        if (this.resources) breakdown.tokens += this.resources.award(`obj${this.challenges.completed}`, completed.reward.tokens, { perWord: false });
      }
    }
    this.history.push({ word: cur.word, attempts, length: cur.word.length, crossings: analysis?.crossings || 0, category: analysis?.category || null, points: breakdown.total });
    this.lastBreakdown = breakdown;
    return breakdown;
  }

  /**
   * Moves from 'solved' to the next round, or completes the run if no placement exists.
   * Selection modes enter 'choosing' (see choose()); other modes place the next word automatically.
   */
  advance() {
    if (this.phase !== 'solved' || this.status !== 'playing') return null;
    if (this.mode.features.selection) return this.#openChoice();
    const next = this.#takeNext();
    this.#beginWord();
    if (!next) {
      this.status = 'complete';
      this.current = null;
      this.phase = 'guessing';
      return null;
    }
    this.current = next;
    this.phase = 'guessing';
    if (this.challenges) this.#refreshObjective(this.solved + 1);
    return next;
  }

  #lengths(n) {
    const l = this.rules.lengthsFor(n).filter((x) => this.dictionary.hasLength(x));
    return l.length ? l : [WORD_LENGTH];
  }

  #openChoice() {
    const n = this.solved + 1;
    this.guesses = [];
    this.hints = {};
    this.extra = 0;
    this.current = null;
    if (this.challenges) this.#refreshObjective(n);
    const options = this.generator.findOptions(this.board, {
      count: 3, wordNumber: n, lengths: this.#lengths(n), pref: this.rules.crossingPreference(n), maxCrossings: this.rules.maxCrossings(n),
    });
    if (!options.length) {
      this.status = 'complete';
      this.options = null;
      this.phase = 'guessing';
      return null;
    }
    this.options = options;
    this.rejected = new Set();
    this.resources?.resetRound();
    this.phase = 'choosing';
    return this.publicOptions;
  }

  /** Starts the Wordle puzzle for the chosen placement. Revalidates so a stale option can never be played. */
  choose(id) {
    if (this.phase !== 'choosing' || this.status !== 'playing') return { ok: false, error: 'Nothing to choose' };
    const o = this.options.find((c) => c.id === id);
    if (!o) return { ok: false, error: 'Unknown option' };
    if (this.board.has(o.word) || !validatePlacement(this.board, o.word, o.x, o.y, o.dir).ok) {
      this.options = this.options.filter((c) => c !== o);
      if (!this.options.length) { this.status = 'complete'; this.phase = 'guessing'; }
      return { ok: false, error: 'That placement is no longer valid' };
    }
    this.#beginWord();
    this.current = { word: o.word, x: o.x, y: o.y, dir: o.dir };
    this.options = null;
    this.phase = 'guessing';
    return { ok: true, current: this.current, category: o.category };
  }

  /** Replaces an offered option with a different valid one. Charged only when a replacement exists. */
  reroll(id) {
    if (this.phase !== 'choosing' || !this.resources) return { ok: false, error: 'Reroll unavailable' };
    const check = this.resources.check('reroll');
    if (!check.ok) return { ok: false, error: check.error };
    const idx = this.options.findIndex((c) => c.id === id);
    if (idx < 0) return { ok: false, error: 'Unknown option' };
    const old = this.options[idx];
    const others = this.options.filter((c) => c !== old);
    const n = this.solved + 1;
    const found = this.generator.findOptions(this.board, {
      count: 6, wordNumber: n, lengths: this.#lengths(n), pref: this.rules.crossingPreference(n), maxCrossings: this.rules.maxCrossings(n),
      excludeIds: new Set([...this.options.map((c) => c.id), ...this.rejected]),
      excludeWords: new Set([...this.options.map((c) => c.word)]), keep: others,
    });
    const pick = found.find((c) => c.category === old.category) || found[0];
    if (!pick) return { ok: false, error: 'No alternative placement available' };
    this.options[idx] = pick;
    this.rejected.add(old.id);
    this.resources.commit('reroll');
    return { ok: true, option: publicOption(pick) };
  }

  /** Reveals one unknown letter of the active word as a locked clue. */
  hint() {
    if (this.phase !== 'guessing' || this.status !== 'playing' || !this.resources) return { ok: false, error: 'Hint unavailable' };
    const check = this.resources.check('hint');
    if (!check.ok) return { ok: false, error: check.error };
    const locked = this.locked;
    const known = new Set(Object.keys(locked).map(Number));
    for (const g of this.guesses) g.result.forEach((r, i) => { if (r === CORRECT) known.add(i); });
    const unknown = [];
    for (let i = 0; i < this.current.word.length; i++) if (!known.has(i)) unknown.push(i);
    // never give the whole word away: at least two letters must be unlocked
    if (unknown.length < 1 || this.current.word.length - Object.keys(locked).length < 2) return { ok: false, error: 'No unknown letters to reveal' };
    const index = unknown[this.rng.int(unknown.length)];
    this.hints[index] = this.current.word[index];
    this.resources.commit('hint');
    return { ok: true, index, letter: this.current.word[index] };
  }

  /** Buys one additional attempt for the current word (capped by config). */
  extraTry() {
    if (this.phase !== 'guessing' || this.status !== 'playing' || !this.resources) return { ok: false, error: 'Extra Try unavailable' };
    const check = this.resources.check('extraTry');
    if (!check.ok) return { ok: false, error: check.error };
    this.extra++;
    this.resources.commit('extraTry');
    return { ok: true, attemptsLeft: this.attemptsLeft };
  }

  /** Re-checks the active objective against the current board; swaps in an achievable one if needed. */
  #refreshObjective(n) {
    const probe = this.generator.probe(this.board, { wordNumber: n, lengths: this.#lengths(n) });
    const game = { solved: this.solved, score: this.score };
    if (!this.challenges.current || !this.challenges.isStillAchievable(probe)) this.challenges.generate(game, probe, this.rng);
  }

  /**
   * Precompute upcoming placements using a projected board containing the
   * current target (known before it is solved). Classic only; safe to call any time.
   */
  precompute() {
    if (!this.mode.features.precompute) return;
    if (!this.current || this.phase !== 'guessing') return;
    const projected = this.board.clone();
    projected.addWord(this.current.word, this.current.x, this.current.y, this.current.dir);
    this.next = { forWord: this.current.word, candidates: this.generator.findCandidates(projected, 4, { wordNumber: this.solved + 2 }) };
  }

  #takeNext() {
    const wordNumber = this.solved + 1;
    if (this.queued) {
      const q = this.queued;
      this.queued = null;
      if (this.#stillValid(q)) return { word: q.word, x: q.x, y: q.y, dir: q.dir };
    }
    if (this.mode.features.variableLength) return this.#takeNextVariable(wordNumber);
    const cached = this.next && this.next.forWord === this.current.word ? this.next.candidates : [];
    this.next = null;
    const fresh = cached.filter((c) => this.#stillValid(c));
    if (fresh.length) return fresh[this.rng.int(Math.min(fresh.length, 3))];
    return this.generator.pickNext(this.board, wordNumber); // on-demand fallback
  }

  /** Wildcard: try the preferred length first, then the other allowed lengths. */
  #takeNextVariable(n) {
    // forced lengths (Anarchy events) go first; the normal order remains as a fallback so a board never ends early
    const order = [...(this.forcedLengths || []), ...this.rules.lengthOrder(n, this.rng)].filter((l, i, a) => a.indexOf(l) === i && this.dictionary.hasLength(l));
    this.forcedLengths = null;
    for (const len of order) {
      const c = this.generator.pickNext(this.board, n, [len], this.rules.crossingPreference(n));
      if (c) return c;
    }
    return null;
  }

  #stillValid(c) {
    return !this.board.has(c.word) && validatePlacement(this.board, c.word, c.x, c.y, c.dir).ok;
  }

  /** Numbers for the results screen. */
  summary() {
    const h = this.history;
    return {
      mode: this.mode.id, modeName: this.mode.name, words: this.solved, score: this.score,
      avgGuesses: h.length ? Math.round((h.reduce((s, x) => s + x.attempts, 0) / h.length) * 100) / 100 : 0,
      intersections: this.board.intersectionCount(), junctions: h.filter((x) => x.category === 'junction').length,
      objectives: this.challenges ? this.challenges.completed : null, tokensEarned: this.resources ? this.resources.earnedTotal : null,
    };
  }

  toJSON() {
    const base = {
      version: this.mode.id === 'classic' ? 1 : 2,
      seed: this.seed,
      rng: this.rng.getState(),
      score: this.score,
      solved: this.solved,
      status: this.status,
      phase: this.phase,
      guesses: this.guesses,
      current: this.current,
      words: this.board.words,
      history: this.history,
    };
    if (this.mode.id === 'classic') return base;
    return {
      ...base,
      mode: this.mode.id,
      hints: this.hints,
      extra: this.extra,
      options: this.options ? this.options.map((o) => ({ word: o.word, x: o.x, y: o.y, dir: o.dir })) : null,
      rejected: [...this.rejected],
      resources: this.resources ? this.resources.toJSON() : null,
      challenges: this.challenges ? this.challenges.toJSON() : null,
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
    this.history = Array.isArray(s.history) ? s.history : [];
    this.hints = s.hints || {};
    this.extra = s.extra || 0;
    for (const w of s.words) this.board.addWord(w.word, w.x, w.y, w.dir);
    if (s.options) this.options = s.options.map((o) => toCandidate(this.board, o));
    this.rejected = new Set(s.rejected || []);
    if (s.resources && this.resources) this.resources = new ResourceManager(this.mode.tokens, s.resources);
    if (s.challenges && this.challenges) this.challenges = new ChallengeManager(s.challenges);
    this.rng.setState(s.rng);
  }
}
