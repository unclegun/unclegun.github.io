import { newDirectorState, isValidDirectorState, LIFECYCLE } from './anarchyDirector.js';
import { newEconomyState, isValidEconomyState } from './arcadeEconomy.js';
import { EVENTS } from './eventRegistry.js';
import { puzzleFromJSON, MINIGAMES } from './puzzles/index.js';

/**
 * Anarchy's own serializable state (stored under `anarchy` in the run save; the engine keeps the crossword).
 * phase: 'guessing' | 'announce' (event card shown) | 'event' (interlude/reverse puzzle active)
 *        | 'transition' (word solved, next round not yet started) | 'over'
 */
export const STATE_VERSION = 1;
export const PHASES = ['guessing', 'announce', 'event', 'transition', 'over'];

export const newAnarchyState = (seed) => ({
  v: STATE_VERSION,
  phase: 'guessing',
  rng: ((seed ^ 0x9e3779b9) >>> 0) || 1,
  director: newDirectorState(),
  economy: newEconomyState(),
  entries: [], // active/announced events: { id, kind, stage, roundsLeft, data }
  plan: null, // decided at solve time, applied by proceed(): { entries, forced, queued }
  puzzle: null, // serialized temporary puzzle for the active interlude
  puzzleEntry: null, // id of the entry that owns `puzzle`
  claimed: [], // chain-reaction intersections already paid
  paid: [], // idempotency keys for score rewards
  detour: null, // { id, reward, puzzle } while a Puzzle Detour is open
  detours: { count: 0, lastRound: 0, byId: {} },
  attemptLimit: null,
  note: null, // short message for the last transition
  stats: { events: {}, bonusScore: 0, coinsSpent: 0, detours: 0 },
});

const isPlacement = (p) => !!p && typeof p.word === 'string' && /^[a-z]+$/.test(p.word) && Number.isInteger(p.x) && Number.isInteger(p.y) && (p.dir === 'across' || p.dir === 'down');

export function validateEntry(e) {
  const def = e && EVENTS[e.id];
  if (!def || e.kind !== def.kind) return false;
  if (!LIFECYCLE.includes(e.stage) || e.stage === 'eligible' || e.stage === 'cleaned') return false;
  if (!(e.roundsLeft === null || (Number.isInteger(e.roundsLeft) && e.roundsLeft >= 0 && e.roundsLeft <= 20))) return false;
  return !!e.data && typeof e.data === 'object';
}

/** Returns true when `a` is a structurally and logically consistent Anarchy state for the given engine save. */
export function validateAnarchyState(a, engineSave) {
  try {
    if (!a || a.v !== STATE_VERSION || !PHASES.includes(a.phase)) return false;
    if (!Number.isFinite(a.rng) || !isValidDirectorState(a.director) || !isValidEconomyState(a.economy)) return false;
    if (!Array.isArray(a.entries) || a.entries.length > 4 || !a.entries.every(validateEntry)) return false;
    if (a.attemptLimit !== null && !(Number.isInteger(a.attemptLimit) && a.attemptLimit >= 1 && a.attemptLimit <= 9)) return false;
    if (!Array.isArray(a.claimed) || !a.claimed.every((k) => typeof k === 'string')) return false;
    if (!Array.isArray(a.paid) || !a.paid.every((k) => typeof k === 'string')) return false;
    if (a.puzzle !== null && !puzzleFromJSON(a.puzzle)) return false;
    if (a.phase === 'event' && !a.puzzle) return false;
    if (a.plan !== null) {
      const p = a.plan;
      if (!p || !Array.isArray(p.entries) || !p.entries.every(validateEntry)) return false;
      if (p.forced !== null && !(Array.isArray(p.forced) && p.forced.every((n) => Number.isInteger(n) && n >= 4 && n <= 7))) return false;
      if (p.queued !== null && !isPlacement(p.queued)) return false;
    }
    if (a.phase === 'transition' && !a.plan) return false;
    if (a.detour !== null) {
      if (!MINIGAMES[a.detour.id] || !puzzleFromJSON(a.detour.puzzle) || !a.detour.reward) return false;
      if (a.phase !== 'guessing' && a.phase !== 'announce') return false;
    }
    const d = a.detours;
    if (!d || !Number.isInteger(d.count) || !Number.isInteger(d.lastRound) || typeof d.byId !== 'object') return false;
    if (!a.stats || typeof a.stats !== 'object') return false;
    if (engineSave) {
      if (a.phase === 'transition' && engineSave.phase !== 'solved') return false;
      if (a.phase === 'over' && engineSave.status === 'playing') return false;
      if (['guessing', 'announce', 'event'].includes(a.phase) && !(engineSave.phase === 'guessing' && engineSave.status === 'playing')) return false;
    }
    return true;
  } catch { return false; }
}
