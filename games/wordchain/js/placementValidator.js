export const H = 'across';
export const V = 'down';
export const WORD_LENGTH = 5;

export const key = (x, y) => x + ',' + y;
export const delta = (dir) => (dir === H ? [1, 0] : [0, 1]);
export const perpendicular = (dir) => (dir === H ? V : H);

export function cellsOf(word, x, y, dir) {
  const [dx, dy] = delta(dir);
  return Array.from({ length: word.length }, (_, i) => ({ x: x + dx * i, y: y + dy * i, i, letter: word[i] }));
}

/**
 * Sparse board: cells maps "x,y" -> { letter, dirs:Set<orientation> }.
 * Checks whether `word` can be placed at (x,y) in `dir`.
 * Returns { ok, crossings, newCells } or { ok:false, reason }.
 */
export function validatePlacement(board, word, x, y, dir) {
  const [dx, dy] = delta(dir);
  const [px, py] = [dy, dx]; // perpendicular step
  const cells = cellsOf(word, x, y, dir);
  let crossings = 0;
  for (const c of cells) {
    const ex = board.cells.get(key(c.x, c.y));
    if (ex) {
      if (ex.letter !== c.letter) return { ok: false, reason: 'conflict' };
      if (ex.dirs.has(dir)) return { ok: false, reason: 'overlap' };
      crossings++;
    } else if (
      board.cells.has(key(c.x + px, c.y + py)) ||
      board.cells.has(key(c.x - px, c.y - py))
    ) {
      return { ok: false, reason: 'adjacent' };
    }
  }
  if (crossings === 0) return { ok: false, reason: 'no-crossing' };
  if (crossings === word.length) return { ok: false, reason: 'no-new-letters' };
  if (board.cells.has(key(x - dx, y - dy)) || board.cells.has(key(x + dx * word.length, y + dy * word.length))) {
    return { ok: false, reason: 'extends-word' };
  }
  return { ok: true, crossings, newCells: word.length - crossings };
}
