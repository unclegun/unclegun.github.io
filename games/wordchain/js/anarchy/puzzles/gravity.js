import { shuffle } from '../../random.js';

export const DIRS = ['up', 'down', 'left', 'right'];
const ROWS = 3;

/** Slides every tile as far as it can go in `dir` (a gravity shift). grid: array of ROWS strings, '.' = empty. */
export function tilt(grid, dir) {
  const h = grid.length;
  const w = grid[0].length;
  const out = Array.from({ length: h }, () => Array(w).fill('.'));
  if (dir === 'left' || dir === 'right') {
    for (let r = 0; r < h; r++) {
      const tiles = [...grid[r]].filter((c) => c !== '.');
      const start = dir === 'left' ? 0 : w - tiles.length;
      tiles.forEach((t, i) => { out[r][start + i] = t; });
    }
  } else {
    for (let c = 0; c < w; c++) {
      const tiles = [];
      for (let r = 0; r < h; r++) if (grid[r][c] !== '.') tiles.push(grid[r][c]);
      const start = dir === 'up' ? 0 : h - tiles.length;
      tiles.forEach((t, i) => { out[start + i][c] = t; });
    }
  }
  return out.map((r) => r.join(''));
}

/** Shortest tilt sequence (BFS) from `grid` to a grid whose bottom row spells `word`, or null within maxDepth. */
export function solveTilts(grid, word, maxDepth = 12) {
  const goal = (g) => g[g.length - 1] === word;
  const seen = new Set([grid.join('|')]);
  let frontier = [{ g: grid, path: [] }];
  if (goal(grid)) return [];
  for (let d = 0; d < maxDepth; d++) {
    const next = [];
    for (const { g, path } of frontier) {
      for (const dir of DIRS) {
        const n = tilt(g, dir);
        const k = n.join('|');
        if (seen.has(k)) continue;
        seen.add(k);
        if (goal(n)) return [...path, dir];
        next.push({ g: n, path: [...path, dir] });
      }
    }
    if (!next.length) return null;
    frontier = next;
  }
  return null;
}

/**
 * Gravity Shift: a 3-row event board holds the word's letters. Each move tilts the whole board so tiles
 * slide in that direction. Spell the word along the bottom row. Generation guarantees a solution.
 */
export class GravityShift {
  constructor({ word, grid, moves = 0 }) {
    this.type = 'gravity';
    this.word = word;
    this.grid = grid;
    this.moves = moves;
    this.par = solveTilts(grid, word)?.length ?? 0;
  }

  static create({ word, rng }) {
    const w = word.length;
    const letters = [...word];
    // Solvable by construction: one tile per column at a random height can always be dropped into the word.
    const base = Array.from({ length: ROWS }, () => Array(w).fill('.'));
    letters.forEach((l, c) => { base[rng.int(ROWS)][c] = l; });
    const baseGrid = base.map((r) => r.join(''));
    for (let attempt = 0; attempt < 60; attempt++) {
      let g = baseGrid;
      const steps = 2 + rng.int(3);
      for (let s = 0; s < steps; s++) g = tilt(g, shuffle(DIRS, rng)[0]);
      const path = solveTilts(g, word, 10);
      if (path && path.length >= 2 && g[ROWS - 1] !== word) return new GravityShift({ word, grid: g });
    }
    return new GravityShift({ word, grid: baseGrid });
  }

  tilt(dir) {
    if (!DIRS.includes(dir)) return false;
    this.grid = tilt(this.grid, dir);
    this.moves++;
    return true;
  }

  hint() { return solveTilts(this.grid, this.word)?.[0] ?? null; }
  isSolved() { return this.grid[this.grid.length - 1] === this.word; }
  stabilize() { this.grid = ['.'.repeat(this.word.length), '.'.repeat(this.word.length), this.word]; }

  toJSON() { return { type: this.type, word: this.word, grid: this.grid.slice(), moves: this.moves }; }

  static fromJSON(j) {
    if (!j || typeof j.word !== 'string' || !Array.isArray(j.grid) || j.grid.length !== ROWS) return null;
    if (!j.grid.every((r) => typeof r === 'string' && r.length === j.word.length && /^[a-z.]+$/.test(r))) return null;
    if (j.grid.join('').replace(/\./g, '').split('').sort().join('') !== [...j.word].sort().join('')) return null;
    return new GravityShift({ word: j.word, grid: j.grid.slice(), moves: Number.isInteger(j.moves) ? j.moves : 0 });
  }
}
