const LETTERS = 'etaoinsrhldcumfpgwybvkxjqz';
export const STORM = { duration: 9000, fall: 3200, drops: 16, columns: 5 };

/**
 * Letter Storm: letters fall in columns. Catch letters that belong to the target word, avoid the rest.
 * Time is passed in explicitly (ms since the storm began) so the model is deterministic and testable.
 * `calm` (reduced motion) mode removes timing: every drop can be caught until the player finishes.
 */
export class LetterStorm {
  constructor({ target, drops, caught = [], finished = false, calm = false }) {
    this.type = 'storm';
    this.target = target;
    this.drops = drops;
    this.caught = caught;
    this.finished = finished;
    this.calm = calm;
  }

  static create({ word, rng, calm = false }) {
    const good = [...new Set(word)];
    const drops = [];
    for (let i = 0; i < STORM.drops; i++) {
      const isGood = i % 2 === 0 || rng.next() < 0.25;
      const letter = isGood ? good[rng.int(good.length)] : LETTERS[rng.int(LETTERS.length)];
      drops.push({ id: i, letter, col: rng.int(STORM.columns), at: Math.round((i / STORM.drops) * (STORM.duration - STORM.fall)) });
    }
    return new LetterStorm({ target: word, drops, calm });
  }

  isGood(d) { return this.target.includes(d.letter); }

  catchDrop(id, now = 0) {
    if (this.finished) return { ok: false };
    const d = this.drops.find((x) => x.id === id);
    if (!d || this.caught.includes(id)) return { ok: false };
    if (!this.calm && (now < d.at || now > d.at + STORM.fall)) return { ok: false };
    this.caught.push(id);
    return { ok: true, good: this.isGood(d) };
  }

  get good() { return this.caught.filter((id) => this.isGood(this.drops[id])).length; }
  get bad() { return this.caught.length - this.good; }
  get net() { return Math.max(0, this.good - this.bad); }

  /** Rewards: net >= 3 -> coins; net >= 6 -> more coins and a free letter reveal. */
  finish() {
    this.finished = true;
    const n = this.net;
    return { net: n, coins: n >= 6 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0, reveal: n >= 6 ? 1 : 0, score: n * 15 };
  }

  isSolved() { return this.finished; }

  toJSON() { return { type: this.type, target: this.target, drops: this.drops.map((d) => ({ ...d })), caught: this.caught.slice(), finished: this.finished, calm: this.calm }; }

  static fromJSON(j) {
    if (!j || typeof j.target !== 'string' || !Array.isArray(j.drops) || j.drops.length !== STORM.drops) return null;
    if (!j.drops.every((d, i) => d && d.id === i && /^[a-z]$/.test(d.letter) && Number.isInteger(d.col) && Number.isInteger(d.at))) return null;
    if (!Array.isArray(j.caught) || !j.caught.every((id) => Number.isInteger(id) && id >= 0 && id < STORM.drops)) return null;
    // timing is wall-clock based: an interrupted storm restarts in calm mode so it can still be completed fairly
    return new LetterStorm({ target: j.target, drops: j.drops.map((d) => ({ ...d })), caught: [...new Set(j.caught)], finished: !!j.finished, calm: true });
  }
}
