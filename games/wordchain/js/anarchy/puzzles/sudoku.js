import { shuffle } from '../../random.js';

const BASE = ['1234', '3412', '2143', '4321'];

const rowOf = (i) => Math.floor(i / 4);
const colOf = (i) => i % 4;
const boxOf = (i) => Math.floor(rowOf(i) / 2) * 2 + Math.floor(colOf(i) / 2);

/** Counts solutions of a 4x4 grid (array of 16 ints, 0 = empty), stopping at `limit`. */
export function countSolutions(grid, limit = 2) {
  const g = grid.slice();
  let count = 0;
  const ok = (i, v) => {
    for (let j = 0; j < 16; j++) {
      if (j === i || g[j] !== v) continue;
      if (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i)) return false;
    }
    return true;
  };
  const go = () => {
    if (count >= limit) return;
    const i = g.indexOf(0);
    if (i < 0) { count++; return; }
    for (let v = 1; v <= 4; v++) {
      if (!ok(i, v)) continue;
      g[i] = v;
      go();
      g[i] = 0;
    }
  };
  go();
  return count;
}

/** True when no row, column or 2x2 box contains a repeated value (ignores empties). */
export function hasNoConflicts(grid) {
  const groups = [[], [], [], [], [], [], [], [], [], [], [], []];
  grid.forEach((v, i) => { if (v) { groups[rowOf(i)].push(v); groups[4 + colOf(i)].push(v); groups[8 + boxOf(i)].push(v); } });
  return groups.every((g) => new Set(g).size === g.length);
}

export const isComplete = (grid) => grid.every((v) => v >= 1 && v <= 4) && hasNoConflicts(grid);

/** A valid, fully solved 4x4 grid produced by permuting digits, rows within bands and columns within stacks. */
export function generateSolution(rng) {
  const digits = shuffle([1, 2, 3, 4], rng);
  const rowOrder = [...shuffle([0, 1], rng), ...shuffle([2, 3], rng)];
  const colOrder = [...shuffle([0, 1], rng), ...shuffle([2, 3], rng)];
  const bands = rng.next() < 0.5;
  const out = [];
  for (const r of bands ? rowOrder : [rowOrder[2], rowOrder[3], rowOrder[0], rowOrder[1]]) {
    for (const c of colOrder) out.push(digits[Number(BASE[r][c]) - 1]);
  }
  return out;
}

/** Mini Sudoku: 4x4 with 2x2 regions and a unique solution. */
export class MiniSudoku {
  constructor({ solution, givens, cells, notes = 0 }) {
    this.type = 'sudoku';
    this.solution = solution;
    this.givens = givens; // boolean[16]
    this.cells = cells; // current values (0 = empty)
    this.notes = notes;
  }

  static create({ rng, round = 1 }) {
    const solution = generateSolution(rng);
    const target = Math.max(5, 9 - Math.floor(round / 6)); // gentle ramp: fewer givens later (never below 5)
    const grid = solution.slice();
    for (const i of shuffle([...Array(16).keys()], rng)) {
      if (grid.filter(Boolean).length <= target) break;
      const keep = grid[i];
      grid[i] = 0;
      if (countSolutions(grid) !== 1) grid[i] = keep;
    }
    return new MiniSudoku({ solution, givens: grid.map(Boolean), cells: grid.slice() });
  }

  set(i, v) {
    if (!Number.isInteger(i) || i < 0 || i > 15 || this.givens[i] || !Number.isInteger(v) || v < 0 || v > 4) return false;
    this.cells[i] = v;
    return true;
  }

  /** Cells that currently break a rule. */
  conflicts() {
    const bad = new Set();
    for (let i = 0; i < 16; i++) {
      if (!this.cells[i]) continue;
      for (let j = 0; j < 16; j++) {
        if (i !== j && this.cells[j] === this.cells[i] && (rowOf(i) === rowOf(j) || colOf(i) === colOf(j) || boxOf(i) === boxOf(j))) bad.add(i);
      }
    }
    return bad;
  }

  isSolved() { return isComplete(this.cells); }

  toJSON() { return { type: this.type, solution: this.solution.slice(), givens: this.givens.slice(), cells: this.cells.slice() }; }

  static fromJSON(j) {
    if (!j || !Array.isArray(j.solution) || !Array.isArray(j.cells) || !Array.isArray(j.givens)) return null;
    if (j.solution.length !== 16 || j.cells.length !== 16 || j.givens.length !== 16) return null;
    if (!isComplete(j.solution) || !j.cells.every((v) => Number.isInteger(v) && v >= 0 && v <= 4)) return null;
    if (!j.givens.every((g, i) => typeof g === 'boolean' && (!g || j.cells[i] === j.solution[i]))) return null;
    return new MiniSudoku({ solution: j.solution.slice(), givens: j.givens.slice(), cells: j.cells.slice() });
  }
}
