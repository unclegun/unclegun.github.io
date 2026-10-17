import { EVENTS } from './eventRegistry.js';
import { compatible } from './eventRules.js';

/** Lifecycle every event follows: eligible → selected → announced → active → resolved → rewarded → cleaned up. */
export const LIFECYCLE = ['eligible', 'selected', 'announced', 'active', 'resolved', 'rewarded', 'cleaned'];

/** Moves an entry forward through the lifecycle; skipping ahead is allowed, going backwards or unknown stages is not. */
export function advanceStage(entry, to) {
  const from = LIFECYCLE.indexOf(entry.stage);
  const next = LIFECYCLE.indexOf(to);
  if (next < 0 || from < 0 || next <= from) return false;
  entry.stage = to;
  return true;
}

export const DIRECTOR_CONFIG = {
  quietRounds: 1, // rounds 1..quietRounds never get events (first modifier can appear in round 2)
  normalChance: 0.28, // chance of a plain recovery round when events are possible
  tierWeights: { minor: 0.5, major: 0.4, rare: 0.1 },
  rareMinRound: 10,
  recencyWindow: 4, // events seen in the last N picks are down-weighted
  recencyPenalty: 0.25,
  historyLimit: 16,
  comboRound: 8, // from this round a compatible second modifier may be added
  comboChance: 0.2,
};

export const newDirectorState = () => ({ history: [], cooldowns: {}, lastTier: null, picks: 0 });

export function isValidDirectorState(d) {
  return !!d && Array.isArray(d.history) && d.history.every((h) => typeof h.id === 'string' && typeof h.round === 'number')
    && !!d.cooldowns && typeof d.cooldowns === 'object' && Object.values(d.cooldowns).every((v) => Number.isInteger(v) && v >= 0 && v < 100)
    && Number.isInteger(d.picks) && d.picks >= 0;
}

/**
 * Decides what happens in the next round. Deterministic for a given rng state.
 *   pick(ctx, rng, state) -> entries[] (possibly empty = a normal recovery round)
 * ctx: { round, board, lastWord, coins, inventory, active:[entries], hasLength(n), claimed, dictionary, reduceMotion }
 * The director owns pacing (recovery after dramatic events), weighted selection, cooldowns,
 * recency penalties, eligibility and compatibility checks. It never blocks the game: with no eligible
 * event it returns [] which is always a valid, plain round.
 */
export class AnarchyDirector {
  constructor(config = {}, events = EVENTS) {
    this.config = { ...DIRECTOR_CONFIG, ...config };
    this.events = events;
  }

  /** All events that could start now, ignoring randomness. */
  eligible(ctx, state, { kinds = null, exclude = [] } = {}) {
    const activeIds = ctx.active.map((e) => e.id);
    return Object.values(this.events).filter((def) => {
      if (kinds && !kinds.includes(def.kind)) return false;
      if (exclude.includes(def.id)) return false;
      if (ctx.round < def.minRound) return false;
      if ((state.cooldowns[def.id] || 0) > 0) return false;
      if (def.tier === 'rare' && ctx.round < this.config.rareMinRound) return false;
      if (activeIds.includes(def.id)) return false;
      if (ctx.active.some((a) => this.events[a.id] && !compatible(this.events[a.id], def))) return false;
      try { return !!def.eligible(ctx); } catch { return false; }
    });
  }

  #weight(def, state) {
    const recent = state.history.slice(-this.config.recencyWindow).some((h) => h.id === def.id);
    return def.weight * (recent ? this.config.recencyPenalty : 1);
  }

  #choose(defs, state, rng) {
    const total = defs.reduce((s, d) => s + this.#weight(d, state), 0);
    if (!defs.length || total <= 0) return null;
    let r = rng.next() * total;
    for (const d of defs) {
      r -= this.#weight(d, state);
      if (r < 0) return d;
    }
    return defs[defs.length - 1];
  }

  #tierRoll(rng, available) {
    const tiers = Object.entries(this.config.tierWeights).filter(([t]) => available.includes(t));
    const total = tiers.reduce((s, [, w]) => s + w, 0);
    let r = rng.next() * total;
    for (const [t, w] of tiers) { r -= w; if (r < 0) return t; }
    return tiers[tiers.length - 1][0];
  }

  makeEntry(def, ctx, rng) {
    return { id: def.id, kind: def.kind, stage: 'selected', roundsLeft: def.rounds ?? (def.kind === 'encounter' ? null : 1), data: def.setup(ctx, rng) };
  }

  tick(state) {
    for (const k of Object.keys(state.cooldowns)) {
      state.cooldowns[k]--;
      if (state.cooldowns[k] <= 0) delete state.cooldowns[k];
    }
  }

  pick(ctx, rng, state, { force = null, tier: wantTier = null } = {}) {
    this.tick(state);
    state.picks++;
    const forced = force && this.events[force];
    if (!forced) {
      if (ctx.round <= this.config.quietRounds) return [];
      if (wantTier) { /* the Chaos Meter decided: skip recovery and plain-round rolls */ }
      else if (state.lastTier === 'major' || state.lastTier === 'rare') { state.lastTier = null; return []; } // recovery
      if (ctx.active.some((a) => a.kind === 'encounter')) return [];
      if (!wantTier && rng.next() < this.config.normalChance) { state.lastTier = null; return []; }
    }
    const pool = this.eligible(ctx, state);
    let def = forced ? forced : null;
    if (!def && wantTier) {
      const tiers = wantTier === 'major' ? ['major', 'rare'] : [wantTier];
      def = this.#choose(pool.filter((d) => tiers.includes(d.tier)), state, rng);
      if (!def) { state.lastTier = null; return []; } // nothing eligible: the meter stays ready
    }
    if (!def) {
      const tier = this.#tierRoll(rng, [...new Set(pool.map((d) => d.tier))].length ? [...new Set(pool.map((d) => d.tier))] : ['minor']);
      def = this.#choose(pool.filter((d) => d.tier === tier), state, rng) || this.#choose(pool, state, rng);
    }
    if (!def) { state.lastTier = null; return []; }
    const entries = [this.makeEntry(def, ctx, rng)];
    if (def.combinable && ctx.round >= this.config.comboRound && rng.next() < this.config.comboChance) {
      const partners = this.eligible({ ...ctx, active: [...ctx.active, { id: def.id, kind: def.kind }] }, state, { kinds: ['modifier'], exclude: [def.id] })
        .filter((d) => d.combinable && d.tier === 'minor' && compatible(def, d));
      const second = this.#choose(partners, state, rng);
      if (second) entries.push(this.makeEntry(second, ctx, rng));
    }
    for (const e of entries) {
      const d = this.events[e.id];
      state.cooldowns[e.id] = d.cooldown || 3;
      state.history.push({ id: e.id, round: ctx.round, tier: d.tier });
    }
    if (state.history.length > this.config.historyLimit) state.history.splice(0, state.history.length - this.config.historyLimit);
    state.lastTier = def.tier;
    return entries;
  }

  /** Alternative modifier for Rule Reroll: eligible, rerollable, compatible with the remaining entries. */
  reroll(entry, ctx, rng, state) {
    const rest = ctx.active.filter((a) => a !== entry && a.id !== entry.id);
    const pool = this.eligible({ ...ctx, active: rest }, { ...state, cooldowns: {} }, { kinds: ['modifier'], exclude: [entry.id] }).filter((d) => d.rerollable && d.tier === this.events[entry.id].tier);
    const def = this.#choose(pool, state, rng);
    return def ? this.makeEntry(def, ctx, rng) : null;
  }
}
