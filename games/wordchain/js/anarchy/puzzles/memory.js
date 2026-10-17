const POOL = 'abcdefghijklmnoprstuwy';

/**
 * Memory Match: a sequence of letters is shown, then hidden. The player recreates the sequence by
 * tapping from a letter bank. Sequence length grows modestly with the round (4..7).
 */
export class MemoryMatch {
  constructor({ sequence, bank, input = [], revealed = true, mistakes = 0 }) {
    this.type = 'memory';
    this.sequence = sequence;
    this.bank = bank;
    this.input = input;
    this.revealed = revealed;
    this.mistakes = mistakes;
  }

  static create({ rng, round = 1 }) {
    const n = Math.min(7, 4 + Math.floor(round / 8));
    const pool = [...POOL];
    const seq = [];
    while (seq.length < n) seq.push(pool.splice(rng.int(pool.length), 1)[0]);
    const decoys = [];
    while (decoys.length < 3) decoys.push(pool.splice(rng.int(pool.length), 1)[0]);
    const bank = [...seq, ...decoys].sort();
    return new MemoryMatch({ sequence: seq, bank });
  }

  hide() { this.revealed = false; }

  /** Appends a tapped letter; a wrong letter is rejected and counted (3 mistakes fail the attempt). */
  press(letter) {
    if (this.revealed || this.failed || this.isSolved()) return { ok: false };
    if (letter === this.sequence[this.input.length]) { this.input.push(letter); return { ok: true, correct: true }; }
    this.mistakes++;
    return { ok: true, correct: false };
  }

  get failed() { return this.mistakes >= 3; }
  isSolved() { return this.input.length === this.sequence.length; }

  toJSON() { return { type: this.type, sequence: this.sequence.slice(), bank: this.bank.slice(), input: this.input.slice(), revealed: this.revealed, mistakes: this.mistakes }; }

  static fromJSON(j) {
    if (!j || !Array.isArray(j.sequence) || !Array.isArray(j.bank) || !Array.isArray(j.input)) return null;
    const letter = (l) => typeof l === 'string' && /^[a-z]$/.test(l);
    if (!j.sequence.every(letter) || !j.bank.every(letter) || !j.input.every(letter) || j.input.length > j.sequence.length) return null;
    if (!j.input.every((l, i) => l === j.sequence[i]) || !j.sequence.every((l) => j.bank.includes(l))) return null;
    return new MemoryMatch({ sequence: j.sequence.slice(), bank: j.bank.slice(), input: j.input.slice(), revealed: !!j.revealed, mistakes: Number.isInteger(j.mistakes) ? Math.min(3, Math.max(0, j.mistakes)) : 0 });
  }
}
