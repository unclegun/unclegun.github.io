/**
 * Tokens and power-ups (Hint, Reroll, Extra Try). Costs, limits and earning rules come from the mode's
 * token config. Usage is two-step so nothing is charged for a failed action:
 *   check(kind) -> { ok, cost, error }   (affordable and under its limit?)
 *   commit(kind)                          (called by the engine only after the action succeeded)
 * Earnings go through award(), which ignores repeated keys and enforces a per-word cap.
 */
const KEPT_KEYS = 30;

export class ResourceManager {
  constructor(config, state = null) {
    this.config = config;
    this.tokens = state ? state.tokens : config.start;
    this.used = state ? { ...state.used } : { hint: 0, reroll: 0, extraTry: 0 }; // counters for the current word/round
    this.awarded = state ? [...state.awarded] : [];
    this.earnedThisWord = state ? state.earnedThisWord : 0;
    this.earnedTotal = state ? state.earnedTotal : 0;
    this.spentTotal = state ? state.spentTotal : 0;
  }

  static isValidState(s, config) {
    return !!s && Number.isInteger(s.tokens) && s.tokens >= 0 && s.tokens <= config.maxBalance
      && s.used && ['hint', 'reroll', 'extraTry'].every((k) => Number.isInteger(s.used[k]) && s.used[k] >= 0 && s.used[k] <= 1000)
      && Array.isArray(s.awarded) && s.awarded.every((k) => typeof k === 'string')
      && Number.isInteger(s.earnedThisWord) && s.earnedThisWord >= 0 && Number.isInteger(s.earnedTotal) && s.earnedTotal >= 0 && Number.isInteger(s.spentTotal) && s.spentTotal >= 0;
  }

  get cost() { return this.config.costs; }

  limitFor(kind) {
    const l = this.config.limits;
    return { hint: l.hintPerWord, reroll: l.rerollPerRound, extraTry: l.extraTryPerWord }[kind];
  }

  check(kind) {
    const cost = this.config.costs[kind];
    if (cost === undefined) return { ok: false, cost: 0, error: 'Unknown power-up' };
    if (this.used[kind] >= this.limitFor(kind)) return { ok: false, cost, error: 'Limit reached' };
    if (this.tokens < cost) return { ok: false, cost, error: 'Not enough Tokens' };
    return { ok: true, cost };
  }

  commit(kind) {
    const c = this.check(kind);
    if (!c.ok) return false;
    this.tokens -= c.cost;
    this.spentTotal += c.cost;
    this.used[kind]++;
    return true;
  }

  /** Earn `amount` tokens once per `key`. Word rewards respect the per-word cap; objective rewards do not. */
  award(key, amount, { perWord = true } = {}) {
    if (amount <= 0 || this.awarded.includes(key)) return 0;
    let n = amount;
    if (perWord) n = Math.min(n, this.config.earn.perWordCap - this.earnedThisWord);
    n = Math.min(n, this.config.maxBalance - this.tokens);
    if (n <= 0) return 0;
    this.awarded.push(key);
    if (this.awarded.length > KEPT_KEYS) this.awarded.shift();
    this.tokens += n;
    this.earnedTotal += n;
    if (perWord) this.earnedThisWord += n;
    return n;
  }

  resetWord() { this.used.hint = 0; this.used.extraTry = 0; this.earnedThisWord = 0; }
  resetRound() { this.used.reroll = 0; }

  toJSON() {
    return { tokens: this.tokens, used: { ...this.used }, awarded: [...this.awarded], earnedThisWord: this.earnedThisWord, earnedTotal: this.earnedTotal, spentTotal: this.spentTotal };
  }
}
