import { cellsOf, key } from '../../placementValidator.js';
import { shuffle } from '../../random.js';

/**
 * Wordquake repair: a short segment (3-5 tiles) of a solved word is knocked loose and shuffled on a
 * separate event row. The player swaps tiles until every tile matches its original position.
 * The permanent crossword is never modified.
 */
export class TileRepair {
  constructor({ cells, letters, moves = 0 }) {
    this.type = 'repair';
    this.cells = cells; // [{x,y}] positions of the displaced segment on the real board
    this.target = cells.map((c) => c.letter);
    this.letters = letters; // current arrangement
    this.moves = moves;
  }

  /** Returns null when the board cannot support the event. */
  static create({ board, rng }) {
    const candidates = board.words.filter((w) => w.word.length >= 4);
    for (const w of shuffle(candidates, rng)) {
      const len = Math.min(w.word.length, 3 + rng.int(3));
      const start = rng.int(w.word.length - len + 1);
      const cells = cellsOf(w.word, w.x, w.y, w.dir).slice(start, start + len).map((c) => ({ x: c.x, y: c.y, letter: c.letter }));
      if (new Set(cells.map((c) => c.letter)).size < 2) continue;
      let letters = cells.map((c) => c.letter);
      for (let t = 0; t < 40; t++) {
        const s = shuffle(letters, rng);
        if (s.join('') !== cells.map((c) => c.letter).join('')) { letters = s; break; }
      }
      if (letters.join('') === cells.map((c) => c.letter).join('')) continue;
      return new TileRepair({ cells, letters });
    }
    return null;
  }

  static supports(board) { return board.words.some((w) => w.word.length >= 4); }

  get displacedKeys() { return this.cells.map((c) => key(c.x, c.y)); }

  /** Minimum swaps from the current arrangement (n - cycles on the position permutation, letter-aware greedy). */
  get par() {
    const arr = this.letters.slice();
    let swaps = 0;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === this.target[i]) continue;
      const j = arr.findIndex((l, k) => k > i && l === this.target[i] && arr[k] !== this.target[k]);
      if (j < 0) continue;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      swaps++;
    }
    return swaps;
  }

  swap(i, j) {
    if (!Number.isInteger(i) || !Number.isInteger(j) || i === j || i < 0 || j < 0 || i >= this.letters.length || j >= this.letters.length) return false;
    [this.letters[i], this.letters[j]] = [this.letters[j], this.letters[i]];
    this.moves++;
    return true;
  }

  isSolved() { return this.letters.every((l, i) => l === this.target[i]); }

  /** Stabilizer: puts every tile back instantly. */
  stabilize() { this.letters = this.target.slice(); }

  toJSON() { return { type: this.type, cells: this.cells.map((c) => ({ ...c })), letters: this.letters.slice(), moves: this.moves }; }

  static fromJSON(j) {
    if (!j || !Array.isArray(j.cells) || !Array.isArray(j.letters) || j.cells.length !== j.letters.length || j.cells.length < 2 || j.cells.length > 7) return null;
    if (!j.cells.every((c) => Number.isInteger(c.x) && Number.isInteger(c.y) && /^[a-z]$/.test(c.letter))) return null;
    const t = j.cells.map((c) => c.letter).sort().join('');
    if (j.letters.slice().sort().join('') !== t) return null;
    return new TileRepair({ cells: j.cells.map((c) => ({ ...c })), letters: j.letters.slice(), moves: Number.isInteger(j.moves) ? j.moves : 0 });
  }
}
