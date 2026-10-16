/**
 * Extensible objective system for Challenge mode. Each definition provides:
 *   requires(probe)           - is it achievable on the *current* board? (probe describes available placements)
 *   build(game)               - { target, text, reward:{score,tokens} } for the objective
 *   update(obj, event, game)  - new progress value after a solved word
 * One objective is active at a time. Add a definition to OBJECTIVES to extend the system.
 *
 * probe: { maxCrossings, hasJunction, dirs:{across,down} } derived from valid candidate placements.
 * event: { attempts, crossings, category, dir, hints, extra, wordScore }
 * game:  { solved, score }
 */
export const OBJECTIVES = {
  streak3: {
    requires: () => true,
    build: () => ({ target: 3, text: 'Solve 3 words in a row in 4 guesses or fewer', reward: { score: 150, tokens: 2 } }),
    update: (o, e) => (e.attempts <= 4 ? o.progress + 1 : 0),
  },
  two_cross: {
    requires: (p) => p.maxCrossings >= 2,
    build: () => ({ target: 1, text: 'Build a word with 2 or more intersections', reward: { score: 100, tokens: 1 } }),
    update: (o, e) => (e.crossings >= 2 ? 1 : o.progress),
  },
  junction: {
    requires: (p) => p.hasJunction,
    build: () => ({ target: 1, text: 'Complete a junction', reward: { score: 200, tokens: 2 } }),
    update: (o, e) => (e.category === 'junction' ? 1 : o.progress),
  },
  steady5: {
    requires: () => true,
    build: () => ({ target: 5, text: 'Add 5 words without a hint or extra try', reward: { score: 200, tokens: 2 } }),
    update: (o, e) => (e.hints === 0 && e.extra === 0 ? o.progress + 1 : 0),
  },
  reach_words: {
    requires: () => true,
    build: (g) => ({ target: g.solved + 4, text: `Reach ${g.solved + 4} solved words`, reward: { score: 150, tokens: 1 } }),
    update: (o, e, g) => g.solved,
  },
  both_orient: {
    requires: (p) => p.dirs.across && p.dirs.down,
    build: () => ({ target: 2, text: 'Place one across and one down word', reward: { score: 120, tokens: 1 }, data: { dirs: [] } }),
    update: (o, e) => {
      const dirs = new Set([...(o.data?.dirs || []), e.dir]);
      o.data = { dirs: [...dirs] };
      return dirs.size;
    },
  },
  target_score: {
    requires: () => true,
    build: (g) => ({ target: g.score + 400, text: `Earn ${g.score + 400} points`, reward: { score: 100, tokens: 1 }, data: { earned: g.score } }),
    // Objective bonuses never count toward score targets, so rewards cannot chain themselves.
    update: (o, e) => {
      const earned = (o.data?.earned ?? 0) + e.wordScore;
      o.data = { earned };
      return Math.min(o.target, earned);
    },
  },
};

export const OBJECTIVE_IDS = Object.keys(OBJECTIVES);

const clone = (o) => (o ? JSON.parse(JSON.stringify(o)) : o);

export class ChallengeManager {
  constructor(state = null) {
    this.current = clone(state?.current) ?? null;
    this.completed = state?.completed ?? 0;
    this.lastId = state?.lastId ?? null;
  }

  static isValidState(s) {
    if (!s || !Number.isInteger(s.completed) || s.completed < 0) return false;
    const c = s.current;
    if (c === null) return true;
    return !!c && c.id in OBJECTIVES && Number.isInteger(c.target) && c.target > 0 && Number.isInteger(c.progress)
      && c.progress >= 0 && c.progress <= c.target && typeof c.text === 'string'
      && c.reward && Number.isInteger(c.reward.score) && Number.isInteger(c.reward.tokens);
  }

  /** Picks the next achievable objective (not the same as the last one). Null if none is achievable. */
  generate(game, probe, rng) {
    const ids = OBJECTIVE_IDS.filter((id) => id !== this.lastId && OBJECTIVES[id].requires(probe));
    if (!ids.length) { this.current = null; return null; }
    const id = ids[rng.int(ids.length)];
    const built = OBJECTIVES[id].build(game);
    this.current = { id, progress: 0, ...built };
    this.lastId = id;
    return this.current;
  }

  /** Drops the active objective if it can no longer be achieved on the current board. */
  isStillAchievable(probe) {
    const c = this.current;
    return !c || c.progress > 0 || OBJECTIVES[c.id].requires(probe);
  }

  /**
   * Applies a solved word. Returns { completed:objective|null }. The caller grants the reward and
   * generates the next objective. Progress only ever changes here, so conditions cannot complete early.
   */
  record(event, game) {
    const c = this.current;
    if (!c) return { completed: null };
    c.progress = Math.min(c.target, Math.max(0, OBJECTIVES[c.id].update(c, event, game)));
    if (c.progress >= c.target) {
      this.completed++;
      const done = { ...c };
      this.current = null;
      return { completed: done };
    }
    return { completed: null };
  }

  toJSON() {
    return { current: clone(this.current), completed: this.completed, lastId: this.lastId };
  }
}
