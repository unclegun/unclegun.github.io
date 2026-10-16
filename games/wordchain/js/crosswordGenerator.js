import { H, V, WORD_LENGTH, key, cellsOf, delta, perpendicular, validatePlacement } from './placementValidator.js';
import { shuffle } from './random.js';
import { crossingPreference } from './difficulty.js';

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

export const DEFAULT_WEIGHTS = {
  placement: 2.5, // random jitter so seeds vary
  crossing: 2, // closeness to the preferred crossing count for the word number
  diversity: 1.5, // reward empty board regions and lightly-used anchor words
  compactness: 1, // penalize bounding-box growth and extreme aspect ratios
};
const REGION = 5; // board region bucket size (cells)
const region = (x, y) => Math.floor(x / REGION) + ',' + Math.floor(y / REGION);

/**
 * Finds the next word placement dynamically from the current board.
 * Builds a bounded candidate pool across *all* solved words and intersection
 * points (a per-anchor / per-offset sample of dictionary words, capped by a
 * validation budget so cost stays flat as the board grows), scores it with
 * configurable weights, then picks a diverse top set so one branch or region
 * does not dominate.
 */
export class CrosswordGenerator {
  constructor({ dictionary, rng, weights = {}, perSlot = 6, maxEvaluations = 700, poolSize = 40 }) {
    this.dictionary = dictionary;
    this.rng = rng;
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
    this.perSlot = perSlot;
    this.maxEvaluations = maxEvaluations;
    this.poolSize = poolSize;
  }

  firstWord() {
    const word = this.dictionary.randomAnswer(this.rng);
    return { word, x: 0, y: 0, dir: H };
  }

  /** Bounded candidate pool (unsorted-by-diversity, scored). */
  buildPool(board, wordNumber = board.words.length + 1) {
    const pref = crossingPreference(wordNumber);
    const counts = { [H]: 0, [V]: 0 };
    for (const w of board.words) counts[w.dir]++;
    const prefer = counts[H] > counts[V] ? V : counts[V] > counts[H] ? H : null;
    const ctx = this.#context(board, pref, prefer);
    const slots = [];
    for (const solved of board.words) {
      const dir = perpendicular(solved.dir);
      const [dx, dy] = delta(solved.dir);
      const [ndx, ndy] = delta(dir);
      for (let si = 0; si < WORD_LENGTH; si++) {
        for (let j = 0; j < WORD_LENGTH; j++) {
          slots.push({ solved, dir, si, x: solved.x + dx * si - ndx * j, y: solved.y + dy * si - ndy * j, j });
        }
      }
    }
    // Round-robin over shuffled slots so every region/anchor gets sampled before the budget runs out.
    const order = shuffle(slots, this.rng);
    const pool = [];
    const seen = new Set();
    let evals = 0;
    for (const slot of order) {
      if (evals >= this.maxEvaluations || pool.length >= this.poolSize * 3) break;
      const words = this.dictionary.wordsWith(slot.j, slot.solved.word[slot.si]);
      if (!words.length) continue;
      const start = this.rng.int(words.length);
      const n = Math.min(this.perSlot, words.length);
      for (let k = 0; k < n; k++) {
        const word = words[(start + k * 7) % words.length]; // strided sample, avoids alphabetical bias
        if (board.has(word)) continue;
        const id = word + slot.x + ',' + slot.y + slot.dir;
        if (seen.has(id)) continue;
        seen.add(id);
        evals++;
        const v = validatePlacement(board, word, slot.x, slot.y, slot.dir);
        if (!v.ok) continue;
        pool.push({
          word, x: slot.x, y: slot.y, dir: slot.dir, crossings: v.crossings,
          anchor: slot.solved.word,
          score: this.#score(ctx, word, slot.x, slot.y, slot.dir, v, slot.solved.word),
        });
      }
    }
    return pool;
  }

  /** Returns up to `limit` diverse candidates, best first. Empty if none exist. */
  findCandidates(board, limit = 5, { wordNumber } = {}) {
    const pool = this.buildPool(board, wordNumber).sort((a, b) => b.score - a.score).slice(0, this.poolSize);
    const out = [];
    const usedRegions = new Map();
    const usedAnchors = new Map();
    const rest = pool.slice();
    while (out.length < limit && rest.length) {
      let bi = 0, bs = -Infinity;
      for (let i = 0; i < rest.length; i++) {
        const c = rest[i];
        const s = c.score - 1.5 * (usedRegions.get(region(c.x, c.y)) || 0) - 1.0 * (usedAnchors.get(c.anchor) || 0);
        if (s > bs) { bs = s; bi = i; }
      }
      const [c] = rest.splice(bi, 1);
      usedRegions.set(region(c.x, c.y), (usedRegions.get(region(c.x, c.y)) || 0) + 1);
      usedAnchors.set(c.anchor, (usedAnchors.get(c.anchor) || 0) + 1);
      out.push(c);
    }
    return out;
  }

  #context(board, pref, prefer) {
    const regions = new Map();
    const anchorUse = new Map();
    for (const w of board.words) {
      for (const c of cellsOf(w.word, w.x, w.y, w.dir)) {
        const r = region(c.x, c.y);
        regions.set(r, (regions.get(r) || 0) + 1);
      }
      let n = 0;
      for (const o of board.words) {
        if (o === w || o.dir === w.dir) continue;
        const wc = cellsOf(w.word, w.x, w.y, w.dir);
        if (cellsOf(o.word, o.x, o.y, o.dir).some((c) => wc.some((d) => d.x === c.x && d.y === c.y))) n++;
      }
      anchorUse.set(w.word, n);
    }
    return { board, pref, prefer, regions, anchorUse, bounds: board.bounds() };
  }

  #score(ctx, word, x, y, dir, v, anchor) {
    const w = this.weights;
    const { pref, prefer, regions, anchorUse, bounds: b } = ctx;
    let s = this.rng.next() * w.placement;
    if (pref) {
      const d = v.crossings < pref.min ? pref.min - v.crossings : v.crossings > pref.max ? v.crossings - pref.max : 0;
      s += w.crossing * (d === 0 ? 1 : -d);
    } else s += w.crossing * (v.crossings === 1 ? 1 : -v.crossings);
    if (dir === prefer) s += 0.5 * w.compactness;
    // diversity: fraction of the new cells landing in sparsely-used regions, minus anchor overuse
    const [dx, dy] = delta(dir);
    let crowd = 0;
    for (let i = 0; i < WORD_LENGTH; i++) crowd += regions.get(region(x + dx * i, y + dy * i)) || 0;
    s += w.diversity * (1 - Math.min(1, crowd / 20));
    s -= w.diversity * 0.4 * (anchorUse.get(anchor) || 0);
    // compactness: bounding-box growth and aspect ratio
    const nx0 = Math.min(b.minX, x), ny0 = Math.min(b.minY, y);
    const nx1 = Math.max(b.maxX, x + dx * 4), ny1 = Math.max(b.maxY, y + dy * 4);
    const bw = nx1 - nx0 + 1, bh = ny1 - ny0 + 1;
    s -= w.compactness * ((bw * bh - (b.maxX - b.minX + 1) * (b.maxY - b.minY + 1)) * 0.04 + Math.abs(bw - bh) * 0.1);
    return s;
  }

  /** Picks one of the top diverse candidates; null if none exist. */
  pickNext(board, wordNumber) {
    const c = this.findCandidates(board, 4, { wordNumber });
    if (!c.length) return null;
    return c[this.rng.int(Math.min(c.length, 3))];
  }
}
