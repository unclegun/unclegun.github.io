import { shuffle } from '../../random.js';

export const INFECTION = { seeds: 2, cap: 6, rounds: 3, minCells: 10, spreadEvery: 2, penaltyPerCell: 10, cleanseCost: 2 };

const neighbors = (k) => {
  const [x, y] = k.split(',').map(Number);
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => `${x + dx},${y + dy}`);
};

/** Word Infection model. `cells` are corrupted crossword cell keys; the real board is never modified. */
export function startInfection(board, rng) {
  if (board.cells.size < INFECTION.minCells) return null;
  const cells = shuffle([...board.cells.keys()], rng).slice(0, INFECTION.seeds);
  return { cells, wrong: 0, cap: INFECTION.cap };
}

export const canInfect = (board) => board.cells.size >= INFECTION.minCells;

/** Every second unsuccessful guess spreads corruption to one adjacent solved cell (bounded by `cap`). */
export function spread(inf, board, rng) {
  inf.wrong++;
  if (inf.wrong % INFECTION.spreadEvery !== 0 || inf.cells.length >= inf.cap) return null;
  const options = [...new Set(inf.cells.flatMap(neighbors))].filter((k) => board.cells.has(k) && !inf.cells.includes(k));
  if (!options.length) return null;
  const k = options[rng.int(options.length)];
  inf.cells.push(k);
  return k;
}

/** Cleans every infected cell covered by the placed word; returns the cleared keys. */
export function cleanseByWord(inf, wordCellKeys) {
  const cleared = inf.cells.filter((k) => wordCellKeys.includes(k));
  inf.cells = inf.cells.filter((k) => !cleared.includes(k));
  return cleared;
}
