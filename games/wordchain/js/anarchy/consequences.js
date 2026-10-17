/**
 * Event Consequence Manager: temporary effects that carry the outcome of one event into later rounds.
 * Pure model (no DOM). State is a small array saved inside the Anarchy state.
 *
 * Effect: { id, source, type, magnitude, trigger, expiresRound, label }
 *   trigger 'roundStart' - applied once when the next round begins (consumed on application)
 *   trigger 'onSolve'    - consumed by the next solved word
 * Rules: at most MAX_ACTIVE effects; one effect per type (a new one replaces a weaker one, a duplicate is merged
 * only up to the cap); effects expire after `expiresRound`; an effect id can only ever be added once (no farming).
 */
export const MAX_ACTIVE = 3;
export const EXPIRY_ROUNDS = 3;

export const EFFECT_TYPES = {
  startHint: { icon: '💡', trigger: 'roundStart', max: 2, describe: (m) => `Next word starts with ${m} extra known letter${m > 1 ? 's' : ''}`, rank: 3 },
  freeGuess: { icon: '➕', trigger: 'roundStart', max: 1, describe: () => 'Next word starts with one free extra guess', rank: 2 },
  shield: { icon: '🛡️', trigger: 'roundStart', max: 1, describe: () => 'Your next wrong guess is shielded', rank: 2 },
  solveBonus: { icon: '🪙', trigger: 'onSolve', max: 6, describe: (m) => `Next solved word pays +${m} coins`, rank: 1 },
};

export const newConsequenceState = () => ({ list: [], seen: [] });

export function isValidConsequenceState(s) {
  if (!s || !Array.isArray(s.list) || !Array.isArray(s.seen) || s.list.length > MAX_ACTIVE) return false;
  if (!s.seen.every((k) => typeof k === 'string') || s.seen.length > 60) return false;
  const types = new Set();
  for (const e of s.list) {
    const t = e && EFFECT_TYPES[e.type];
    if (!t || typeof e.id !== 'string' || typeof e.source !== 'string' || e.trigger !== t.trigger) return false;
    if (!Number.isInteger(e.magnitude) || e.magnitude < 1 || e.magnitude > t.max) return false;
    if (!Number.isInteger(e.expiresRound) || e.expiresRound < 0 || e.expiresRound > 1e6) return false;
    if (types.has(e.type)) return false;
    types.add(e.type);
  }
  return true;
}

export class ConsequenceManager {
  constructor(state = null) {
    const ok = state && isValidConsequenceState(state);
    this.s = ok ? { list: state.list.map((e) => ({ ...e })), seen: [...state.seen] } : newConsequenceState();
  }

  get active() { return this.s.list; }

  /** Adds an effect. Returns the stored effect, or null when it is a duplicate id, too weak, or would exceed the cap. */
  add({ id, source, type, magnitude = 1, round, label }) {
    const t = EFFECT_TYPES[type];
    if (!t || !id || this.s.seen.includes(id)) return null;
    this.s.seen.push(id);
    if (this.s.seen.length > 60) this.s.seen.shift();
    const mag = Math.max(1, Math.min(t.max, Math.floor(magnitude)));
    const effect = { id, source, type, magnitude: mag, trigger: t.trigger, expiresRound: round + EXPIRY_ROUNDS, label: label || t.describe(mag) };
    const same = this.s.list.find((e) => e.type === type);
    if (same) { // contradictory/duplicate: merge magnitude up to the cap and refresh the expiry
      same.magnitude = Math.min(t.max, same.magnitude + mag);
      same.expiresRound = Math.max(same.expiresRound, effect.expiresRound);
      same.label = t.describe(same.magnitude);
      return same;
    }
    if (this.s.list.length >= MAX_ACTIVE) {
      const weakest = this.s.list.reduce((a, b) => (EFFECT_TYPES[a.type].rank <= EFFECT_TYPES[b.type].rank ? a : b));
      if (EFFECT_TYPES[weakest.type].rank >= t.rank) return null;
      this.s.list.splice(this.s.list.indexOf(weakest), 1);
    }
    this.s.list.push(effect);
    return effect;
  }

  /** Drops effects whose window has passed. Returns the expired ones. */
  expire(round) {
    const gone = this.s.list.filter((e) => round > e.expiresRound);
    if (gone.length) this.s.list = this.s.list.filter((e) => !gone.includes(e));
    return gone;
  }

  take(type) {
    const i = this.s.list.findIndex((e) => e.type === type);
    return i < 0 ? null : this.s.list.splice(i, 1)[0];
  }

  has(type) { return this.s.list.some((e) => e.type === type); }

  clear() { this.s.list = []; }

  toJSON() { return { list: this.s.list.map((e) => ({ ...e })), seen: [...this.s.seen] }; }
}
