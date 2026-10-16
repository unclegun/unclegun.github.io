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

  /** Number of cells shared by an across and a down word. */
  intersectionCount() {
    let n = 0;
    for (const v of this.cells.values()) if (v.dirs.size > 1) n++;
    return n;
  }

  /** Map word -> number of perpendicular words crossing it. */
  degrees() {
    const out = new Map(this.words.map((w) => [w.word, 0]));
    for (const w of this.words) {
      for (const c of cellsOf(w.word, w.x, w.y, w.dir)) {
        if (this.cells.get(key(c.x, c.y)).dirs.size > 1) out.set(w.word, out.get(w.word) + 1);
      }
    }
    return out;
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

export const CATEGORIES = ['expand', 'connect', 'junction'];
export const footprintId = (p) => `${p.x},${p.y},${p.dir},${p.word.length}`;

/**
 * Describes a (valid) placement against a board: true intersections (shared cells only, never mere
 * adjacency, which the validator rejects), board growth and a classification.
 *   expand   - one crossing, grows into open space
 *   connect  - two crossings, linking existing words
 *   junction - three or more crossings, or joins two words that are already hubs
 * `ctx` may carry precomputed { degrees, bounds } to keep batch analysis cheap.
 */
export function analyzePlacement(board, p, ctx = {}) {
  const degrees = ctx.degrees || board.degrees();
  const b = ctx.bounds || (board.words.length ? board.bounds() : null);
  const cells = cellsOf(p.word, p.x, p.y, p.dir);
  const intersections = [];
  for (const c of cells) if (board.cells.has(key(c.x, c.y))) intersections.push({ x: c.x, y: c.y, index: c.i, letter: c.letter });
  const crossed = board.words.filter((w) => w.dir !== p.dir && cellsOf(w.word, w.x, w.y, w.dir).some((c) => intersections.some((i) => i.x === c.x && i.y === c.y)));
  const crossings = intersections.length;
  const [dx, dy] = delta(p.dir);
  const last = p.word.length - 1;
  let growth = 0, aspectAfter = 1, aspectBefore = 1, area = 0;
  if (b) {
    const bw0 = b.maxX - b.minX + 1, bh0 = b.maxY - b.minY + 1;
    const nx0 = Math.min(b.minX, p.x), ny0 = Math.min(b.minY, p.y);
    const nx1 = Math.max(b.maxX, p.x + dx * last), ny1 = Math.max(b.maxY, p.y + dy * last);
    const bw = nx1 - nx0 + 1, bh = ny1 - ny0 + 1;
    growth = bw * bh - bw0 * bh0;
    aspectBefore = Math.max(bw0, bh0) / Math.min(bw0, bh0);
    aspectAfter = Math.max(bw, bh) / Math.min(bw, bh);
    area = bw * bh;
  }
  const hubs = crossed.length >= 2 && crossed.every((w) => (degrees.get(w.word) || 0) >= 2);
  const category = crossings >= 3 || hubs ? 'junction' : crossings === 2 ? 'connect' : 'expand';
  return {
    crossings, intersections, revealed: crossings, growth, category, crossedWords: crossed.map((w) => w.word),
    // Linear = lengthens the already-longer side of the bounding box.
    linear: !!b && growth > 0 && aspectAfter > aspectBefore && aspectAfter >= 2,
    area, newCells: p.word.length - crossings,
    bonuses: { intersections: Math.max(0, crossings - 1), junction: category === 'junction', connect: category === 'connect', compact: !!b && growth === 0 },
  };
}

/** Selection-UI view of a candidate: never contains the hidden word. */
export const publicOption = (c) => ({
  id: c.id, x: c.x, y: c.y, dir: c.dir, length: c.word.length, crossings: c.crossings, revealed: c.revealed,
  intersections: c.intersections.map((i) => ({ ...i })), category: c.category, growth: c.growth, bonuses: { ...c.bonuses },
});

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

  firstWord(length = WORD_LENGTH) {
    const word = length === WORD_LENGTH ? this.dictionary.randomAnswer(this.rng) : this.dictionary.randomAnswer(this.rng, length);
    return { word, x: 0, y: 0, dir: H };
  }

  /** Bounded candidate pool (unsorted-by-diversity, scored). */
  buildPool(board, wordNumber = board.words.length + 1, opts = {}) {
    const lengths = opts.lengths || [WORD_LENGTH];
    const perSlot = opts.perSlot ?? this.perSlot;
    const maxEvaluations = opts.maxEvaluations ?? this.maxEvaluations;
    const cap = opts.cap ?? this.poolSize * 3;
    const pref = opts.pref !== undefined ? opts.pref : crossingPreference(wordNumber);
    const counts = { [H]: 0, [V]: 0 };
    for (const w of board.words) counts[w.dir]++;
    const prefer = counts[H] > counts[V] ? V : counts[V] > counts[H] ? H : null;
    const ctx = this.#context(board, pref, prefer);
    const slots = [];
    for (const solved of board.words) {
      const dir = perpendicular(solved.dir);
      const [dx, dy] = delta(solved.dir);
      const [ndx, ndy] = delta(dir);
      for (const len of lengths) {
        for (let si = 0; si < solved.word.length; si++) {
          for (let j = 0; j < len; j++) {
            slots.push({ solved, dir, si, len, x: solved.x + dx * si - ndx * j, y: solved.y + dy * si - ndy * j, j });
          }
        }
      }
    }
    // Round-robin over shuffled slots so every region/anchor gets sampled before the budget runs out.
    const order = shuffle(slots, this.rng);
    const pool = [];
    const seen = new Set();
    let evals = 0;
    for (const slot of order) {
      if (evals >= maxEvaluations || pool.length >= cap) break;
      const words = slot.len === WORD_LENGTH ? this.dictionary.wordsWith(slot.j, slot.solved.word[slot.si]) : this.dictionary.wordsWith(slot.j, slot.solved.word[slot.si], slot.len);
      if (!words.length) continue;
      const start = this.rng.int(words.length);
      const n = Math.min(perSlot, words.length);
      for (let k = 0; k < n; k++) {
        const word = words[(start + k * 7) % words.length]; // strided sample, avoids alphabetical bias
        if (board.has(word) || (opts.excludeWords && opts.excludeWords.has(word))) continue;
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
  findCandidates(board, limit = 5, { wordNumber, lengths, pref } = {}) {
    const pool = this.buildPool(board, wordNumber, { lengths, pref }).sort((a, b) => b.score - a.score).slice(0, this.poolSize);
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
    for (let i = 0; i < word.length; i++) crowd += regions.get(region(x + dx * i, y + dy * i)) || 0;
    s += w.diversity * (1 - Math.min(1, crowd / 20));
    s -= w.diversity * 0.4 * (anchorUse.get(anchor) || 0);
    // compactness: bounding-box growth and aspect ratio
    const nx0 = Math.min(b.minX, x), ny0 = Math.min(b.minY, y);
    const nx1 = Math.max(b.maxX, x + dx * (word.length - 1)), ny1 = Math.max(b.maxY, y + dy * (word.length - 1));
    const bw = nx1 - nx0 + 1, bh = ny1 - ny0 + 1;
    s -= w.compactness * ((bw * bh - (b.maxX - b.minX + 1) * (b.maxY - b.minY + 1)) * 0.04 + Math.abs(bw - bh) * 0.1);
    return s;
  }

  /** Picks one of the top diverse candidates; null if none exist. */
  pickNext(board, wordNumber, lengths, pref) {
    const c = this.findCandidates(board, 4, { wordNumber, lengths, pref });
    if (!c.length) return null;
    return c[this.rng.int(Math.min(c.length, 3))];
  }

  /**
   * Strategic placement options for the selection modes. Samples a larger bounded pool, classifies every
   * candidate (expand / connect / junction) and returns up to `count` distinct choices: one per category
   * where valid candidates exist first, then the best remaining ones. Each result is a full candidate
   * (including the hidden word); use `publicOption` for the UI.
   */
  findOptions(board, { count = 3, wordNumber, lengths = [WORD_LENGTH], pref, maxCrossings = Infinity, excludeIds = new Set(), excludeWords = new Set(), keep = [] } = {}) {
    const pool = this.buildPool(board, wordNumber, {
      lengths, pref, perSlot: 24, maxEvaluations: 2500, cap: this.poolSize * 6, excludeWords,
    });
    const ctx = { degrees: board.degrees(), bounds: board.bounds() };
    const all = [];
    for (const c of pool) {
      const id = footprintId(c);
      if (excludeIds.has(id)) continue;
      all.push({ ...c, id, ...analyzePlacement(board, c, ctx) });
    }
    const capped = all.filter((c) => c.crossings <= maxCrossings);
    const cands = (capped.length ? capped : all).sort((a, b) => b.score - a.score);
    const chosen = [];
    const keepFoot = keep.map((k) => ({ ...k }));
    const near = (a, b) => {
      if (a.id === b.id) return true;
      if (a.dir !== b.dir) return false;
      const ext = (p) => { const [dx, dy] = delta(p.dir); const n = (p.length ?? p.word.length) - 1; return [p.x - 1, p.y - 1, p.x + dx * n + 1, p.y + dy * n + 1]; };
      const [a0, a1, a2, a3] = ext(a), [b0, b1, b2, b3] = ext(b);
      return a0 <= b2 && b0 <= a2 && a1 <= b3 && b1 <= a3;
    };
    const fits = (c, strict) => !chosen.some((s) => (strict ? near(c, s) : c.id === s.id)) && !keepFoot.some((s) => (strict ? near(c, s) : c.id === s.id))
      && !chosen.some((s) => s.word === c.word);
    for (const strict of [true, false]) {
      for (const cat of CATEGORIES) {
        if (chosen.length >= count) break;
        if (chosen.some((s) => s.category === cat)) continue;
        const c = cands.find((x) => x.category === cat && fits(x, strict));
        if (c) chosen.push(c);
      }
      for (const c of cands) {
        if (chosen.length >= count) break;
        if (fits(c, strict)) chosen.push(c);
      }
    }
    return chosen.slice(0, count);
  }

  /** What the board currently allows (used so objectives are only generated when achievable). */
  probe(board, { wordNumber, lengths = [WORD_LENGTH] } = {}) {
    const pool = this.buildPool(board, wordNumber, { lengths, perSlot: 24, maxEvaluations: 2500, cap: this.poolSize * 6 });
    const ctx = { degrees: board.degrees(), bounds: board.bounds() };
    const out = { maxCrossings: 0, hasJunction: false, dirs: { across: false, down: false } };
    for (const c of pool) {
      const a = analyzePlacement(board, c, ctx);
      out.maxCrossings = Math.max(out.maxCrossings, a.crossings);
      if (a.category === 'junction') out.hasJunction = true;
      out.dirs[c.dir] = true;
    }
    return out;
  }
}
