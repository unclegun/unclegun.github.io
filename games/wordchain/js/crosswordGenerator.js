import { H, V, WORD_LENGTH, key, cellsOf, delta, perpendicular, validatePlacement } from './placementValidator.js';
import { shuffle } from './random.js';

/** Sparse-coordinate crossword board with solved words. Independent of rendering. */
export class CrosswordBoard {
  constructor() {
    this.cells = new Map();
    this.words = [];
  }

  clone() {
    const b = new CrosswordBoard();
    for (const [k, v] of this.cells) b.cells.set(k, { letter: v.letter, dirs: new Set(v.dirs) });
    b.words = this.words.map((w) => ({ ...w }));
    return b;
  }

  has(word) {
    return this.words.some((w) => w.word === word);
  }

  addWord(word, x, y, dir) {
    for (const c of cellsOf(word, x, y, dir)) {
      const k = key(c.x, c.y);
      if (!this.cells.has(k)) this.cells.set(k, { letter: c.letter, dirs: new Set() });
      this.cells.get(k).dirs.add(dir);
    }
    this.words.push({ word, x, y, dir });
  }

  bounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const k of this.cells.keys()) {
      const [x, y] = k.split(',').map(Number);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    return { minX, minY, maxX, maxY };
  }
}

/**
 * Finds the next word placement dynamically from the current board.
 * Scans (shuffled) solved words and their letters, uses the dictionary index to
 * get words sharing that letter, validates each placement, and scores candidates
 * for familiarity, crossing count, orientation balance and compact growth.
 */
export class CrosswordGenerator {
  constructor({ dictionary, rng, sampleSize = 24 }) {
    this.dictionary = dictionary;
    this.rng = rng;
    this.sampleSize = sampleSize;
  }

  firstWord() {
    const word = this.dictionary.randomAnswer(this.rng);
    return { word, x: 0, y: 0, dir: H };
  }

  /** Returns up to `limit` scored candidates, best first. Exhaustive if few exist. */
  findCandidates(board, limit = 5, sampleSize = this.sampleSize) {
    const found = [];
    const seen = new Set();
    const counts = { [H]: 0, [V]: 0 };
    for (const w of board.words) counts[w.dir]++;
    const prefer = counts[H] > counts[V] ? V : counts[V] > counts[H] ? H : null;

    for (const solved of shuffle(board.words, this.rng)) {
      const dir = perpendicular(solved.dir);
      const [dx, dy] = delta(solved.dir);
      const [ndx, ndy] = delta(dir);
      for (const si of shuffle([0, 1, 2, 3, 4], this.rng)) {
        const cx = solved.x + dx * si;
        const cy = solved.y + dy * si;
        for (let j = 0; j < WORD_LENGTH; j++) {
          const x = cx - ndx * j;
          const y = cy - ndy * j;
          for (const word of this.dictionary.wordsWith(j, solved.word[si])) {
            if (board.has(word)) continue;
            const id = word + x + ',' + y + dir;
            if (seen.has(id)) continue;
            seen.add(id);
            const v = validatePlacement(board, word, x, y, dir);
            if (!v.ok) continue;
            found.push({ word, x, y, dir, crossings: v.crossings, score: this.#score(board, word, x, y, dir, v, prefer) });
          }
        }
      }
      if (found.length >= sampleSize) break;
    }
    return found.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  #score(board, word, x, y, dir, v, prefer) {
    let s = this.rng.next() * 3; // randomness
    s += v.crossings <= 2 ? 3 - (v.crossings - 1) : -2 * v.crossings; // favor 1-2 crossings
    if (dir === prefer) s += 1; // natural alternation
    // compact, balanced growth: penalize bounding-box growth and extreme aspect ratio
    const b = board.bounds();
    const [dx, dy] = delta(dir);
    const nx0 = Math.min(b.minX, x), ny0 = Math.min(b.minY, y);
    const nx1 = Math.max(b.maxX, x + dx * 4), ny1 = Math.max(b.maxY, y + dy * 4);
    const w = nx1 - nx0 + 1, h = ny1 - ny0 + 1;
    s -= (w * h - (b.maxX - b.minX + 1) * (b.maxY - b.minY + 1)) * 0.08;
    s -= Math.abs(w - h) * 0.15;
    return s;
  }

  /** Picks one of the top candidates at random-weighted fashion; null if none exist. */
  pickNext(board) {
    const c = this.findCandidates(board, 4);
    if (!c.length) return null;
    return c[this.rng.int(Math.min(c.length, 3))];
  }
}
