/**
 * Local-only Anarchy playtest metrics. Nothing leaves the browser; export is a manual JSON download.
 * Storage is injectable for tests. Counters only, no personal data.
 */
const KEY = 'wordchain.anarchy.metrics.v1';
const MAX_RUNS = 20;

const newRun = (now) => ({ startedAt: now, endedAt: null, rounds: 0, guesses: 0, events: {}, majorTimes: [], coinsEarned: 0, coinsSpent: 0, shopOpens: 0, purchases: {}, failed: 0, rerolls: 0, puzzleMs: 0, minigames: { completed: 0, abandoned: 0 }, abandonedEvents: {} });

export class PlaytestMetrics {
  constructor(storage = typeof localStorage !== 'undefined' ? localStorage : null, clock = () => Date.now()) {
    this.storage = storage; this.clock = clock; this.run = null; this.history = this.#load();
  }
  #load() { try { const d = JSON.parse(this.storage?.getItem(KEY) || '[]'); return Array.isArray(d) ? d : []; } catch { return []; } }
  #save() { try { this.storage?.setItem(KEY, JSON.stringify(this.history.slice(-MAX_RUNS))); } catch { /* storage unavailable: metrics are optional */ } }
  #r() { if (!this.run) { this.run = newRun(this.clock()); this.history.push(this.run); } return this.run; }

  startRun() { this.endRun(); this.run = null; this.#r(); this.#save(); }
  endRun() { if (this.run && !this.run.endedAt) { this.run.endedAt = this.clock(); this.#save(); } }
  word({ attempts = 1, coins = 0 } = {}) { const r = this.#r(); r.rounds++; r.guesses += attempts; r.coinsEarned += coins; this.#save(); }
  event(id, major = false) {
    const r = this.#r(); r.events[id] = (r.events[id] || 0) + 1;
    if (major) r.majorTimes.push(this.clock());
    this.#save();
  }
  purchase(item, cost) { const r = this.#r(); r.purchases[item] = (r.purchases[item] || 0) + 1; r.coinsSpent += cost; this.#save(); }
  shopOpened() { this.#r().shopOpens++; this.#save(); }
  failed() { this.#r().failed++; this.#save(); }
  reroll() { this.#r().rerolls++; this.#save(); }
  puzzle({ ms = 0, completed = true, id = null } = {}) {
    const r = this.#r(); r.puzzleMs += ms;
    if (completed) r.minigames.completed++; else { r.minigames.abandoned++; if (id) r.abandonedEvents[id] = (r.abandonedEvents[id] || 0) + 1; }
    this.#save();
  }
  /** Aggregates for the export: averages and gaps between major events. */
  summary() {
    const runs = this.history;
    const rounds = runs.reduce((s, r) => s + r.rounds, 0);
    const guesses = runs.reduce((s, r) => s + r.guesses, 0);
    const gaps = runs.flatMap((r) => r.majorTimes.slice(1).map((t, i) => t - r.majorTimes[i]));
    return { runs: runs.length, rounds, avgGuessesPerWord: rounds ? +(guesses / rounds).toFixed(2) : 0, avgMsBetweenMajorEvents: gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null, failedRuns: runs.reduce((s, r) => s + r.failed, 0) };
  }
  exportJSON() { return JSON.stringify({ exportedAt: new Date(this.clock()).toISOString(), summary: this.summary(), runs: this.history }, null, 2); }
  clear() { this.history = []; this.run = null; this.#save(); }
}
