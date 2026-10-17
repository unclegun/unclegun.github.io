/**
 * Anarchy economy: Coins are spent and earned within a run; Score is never spent (it lives on the engine).
 * Everything is configuration so costs, caps and eligibility can be tuned in one place.
 *
 * Purchasing is two-step so nothing is charged for an action that fails:
 *   check(item)  -> { ok, cost, error }
 *   commit(item) -> charges and records the purchase (call only after the effect succeeded)
 */
export const ECONOMY = {
  start: 3,
  maxCoins: 99,
  earn: { word: 1, efficientMaxAttempts: 3, efficient: 1, multiCross: 1 },
  items: {
    extraGuess: { name: 'Extra Guess', icon: '➕', cost: 4, limitPerWord: 2, kind: 'instant', desc: 'Adds one attempt to the current puzzle.' },
    reveal: { name: 'Reveal Letter', icon: '💡', cost: 3, limitPerWord: 2, kind: 'instant', desc: 'Reveals and locks one unknown letter.' },
    shield: { name: 'Mistake Shield', icon: '🛡️', cost: 3, maxHeld: 2, kind: 'held', desc: 'Your next unsuccessful guess will not use an attempt.' },
    reroll: { name: 'Rule Reroll', icon: '🎲', cost: 3, maxHeld: 1, kind: 'held', desc: 'Swaps the announced modifier for a different eligible one.' },
    wildcardTile: { name: 'Wildcard Tile', icon: '🔤', cost: 3, maxHeld: 2, kind: 'held', desc: 'Supplies a missing letter in a Letter Collapse puzzle.' },
    stabilizer: { name: 'Stabilizer', icon: '⚓', cost: 4, maxHeld: 1, kind: 'held', desc: 'Steadies a board mutation: resolves Wordquake, Gravity Shift or Word Infection at half reward.' },
    chaosCatalyst: { name: 'Chaos Catalyst', icon: '🌪️', cost: 3, limitPerWord: 1, kind: 'instant', desc: 'Adds chaos now. The next major event pays +3 coins.' },
    chaosBrake: { name: 'Chaos Brake', icon: '🧯', cost: 3, limitPerWord: 1, kind: 'instant', desc: 'Drains the Chaos Meter and delays the next major event.' },
    doubleCoins: { name: 'Double Coins', icon: '✨', cost: 5, kind: 'timed', rounds: 2, desc: 'Coin rewards are doubled for the next two solved words.' },
  },
};

/** Free credits earned from Puzzle Detours. */
export const CREDITS = ['freeReveal', 'freeGuess'];

const HELD = ['shield', 'reroll', 'wildcardTile', 'stabilizer', ...CREDITS];
const KEPT_KEYS = 60;

export const newEconomyState = () => ({
  coins: ECONOMY.start, earned: 0, spent: 0,
  inv: Object.fromEntries(HELD.map((k) => [k, 0])),
  used: { extraGuess: 0, reveal: 0 }, // per current word
  doubleCoins: 0, shieldArmed: false, awarded: [],
});

export function isValidEconomyState(e, config = ECONOMY) {
  const n = (v, max = 1e6) => Number.isInteger(v) && v >= 0 && v <= max;
  return !!e && n(e.coins, config.maxCoins) && n(e.earned) && n(e.spent) && !!e.inv
    && HELD.every((k) => n(e.inv[k], 20)) && e.inv.shield <= config.items.shield.maxHeld + 1
    && !!e.used && n(e.used.extraGuess, 50) && n(e.used.reveal, 50) && n(e.doubleCoins, 10)
    && typeof e.shieldArmed === 'boolean' && Array.isArray(e.awarded) && e.awarded.every((k) => typeof k === 'string');
}

export class ArcadeEconomy {
  constructor(state = null, config = ECONOMY) {
    this.config = config;
    this.s = state ? { ...state, inv: { ...state.inv }, used: { ...state.used }, awarded: [...state.awarded] } : newEconomyState();
  }

  get coins() { return this.s.coins; }
  get inventory() { return this.s.inv; }

  held(kind) { return this.s.inv[kind] || 0; }

  /** Is the item affordable and under its caps? Never mutates. */
  check(item) {
    const def = this.config.items[item];
    if (!def) return { ok: false, cost: 0, error: 'Unknown item' };
    const cost = def.cost;
    if (def.limitPerWord !== undefined && (this.s.used[item] || 0) >= def.limitPerWord) return { ok: false, cost, error: 'Limit reached for this word' };
    if (def.maxHeld !== undefined && this.held(item) >= def.maxHeld) return { ok: false, cost, error: 'You are carrying the maximum' };
    if (def.kind === 'timed' && this.s.doubleCoins > 0) return { ok: false, cost, error: 'Already active' };
    if (this.s.coins < cost) return { ok: false, cost, error: 'Not enough coins' };
    return { ok: true, cost };
  }

  /** Charges for `item` and records it. Held items go to the inventory; timed items start. */
  commit(item) {
    const c = this.check(item);
    if (!c.ok) return false;
    const def = this.config.items[item];
    this.s.coins -= c.cost;
    this.s.spent += c.cost;
    if (def.kind === 'held') this.s.inv[item]++;
    else if (def.kind === 'timed') this.s.doubleCoins = def.rounds;
    else this.s.used[item] = (this.s.used[item] || 0) + 1;
    return true;
  }

  /** Uses a free credit if one exists (from detours). */
  takeCredit(kind) {
    if (this.s.inv[kind] > 0) { this.s.inv[kind]--; return true; }
    return false;
  }

  grantCredit(kind, n = 1) { this.s.inv[kind] = Math.min(20, this.s.inv[kind] + n); }

  /** Consumes one held item (shield, wildcard tile, stabilizer, reroll). */
  consume(kind) {
    if (this.s.inv[kind] <= 0) return false;
    this.s.inv[kind]--;
    return true;
  }

  /** Earns coins once per `key` (idempotent). Honors Double Coins and the cap. Returns coins actually added. */
  award(key, amount, { doubling = true } = {}) {
    if (!(amount > 0) || this.s.awarded.includes(key)) return 0;
    let n = Math.floor(amount) * (doubling && this.s.doubleCoins > 0 ? 2 : 1);
    n = Math.min(n, this.config.maxCoins - this.s.coins);
    this.s.awarded.push(key);
    if (this.s.awarded.length > KEPT_KEYS) this.s.awarded.shift();
    if (n <= 0) return 0;
    this.s.coins += n;
    this.s.earned += n;
    return n;
  }

  hasAwarded(key) { return this.s.awarded.includes(key); }

  /** Removes up to `amount` coins as a penalty (never below zero). */
  lose(amount) {
    const n = Math.min(this.s.coins, Math.max(0, Math.floor(amount)));
    this.s.coins -= n;
    return n;
  }

  /** Called when a word is solved: counters for the next word reset, timed effects tick. */
  endWord() {
    this.s.used = { extraGuess: 0, reveal: 0, chaosCatalyst: 0, chaosBrake: 0 };
    if (this.s.doubleCoins > 0) this.s.doubleCoins--;
  }

  toJSON() { return { ...this.s, inv: { ...this.s.inv }, used: { ...this.s.used }, awarded: [...this.s.awarded] }; }
}
