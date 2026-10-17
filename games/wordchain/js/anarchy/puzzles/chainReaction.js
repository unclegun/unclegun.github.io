import { cellsOf, key } from '../../placementValidator.js';

/**
 * Chain Reaction: starting from the word just placed, the reaction travels through every connected word
 * via shared intersection cells. Each intersection pays once per run (`claimed` holds the keys already paid).
 * Pure: reads the board, never changes it.
 */
export const CHAIN = { pointsPerLink: 15, maxLinks: 8, linksPerCoin: 3, maxCoins: 3 };

export function computeChain(board, start, claimed = []) {
  const done = new Set(claimed);
  const wordKey = (w) => `${w.word}@${w.x},${w.y},${w.dir}`;
  const byCell = new Map(); // cell key -> words covering it
  for (const w of board.words) {
    for (const c of cellsOf(w.word, w.x, w.y, w.dir)) {
      const k = key(c.x, c.y);
      if (!byCell.has(k)) byCell.set(k, []);
      byCell.get(k).push(w);
    }
  }
  const startWord = board.words.find((w) => w.word === start.word && w.x === start.x && w.y === start.y && w.dir === start.dir);
  if (!startWord) return { steps: [], links: [], points: 0, coins: 0 };
  const seenWords = new Set([wordKey(startWord)]);
  const seenCells = new Set();
  const links = [];
  const steps = [];
  let frontier = [startWord];
  while (frontier.length && links.length < CHAIN.maxLinks) {
    const next = [];
    const step = { cells: [], words: [] };
    for (const w of frontier) {
      for (const c of cellsOf(w.word, w.x, w.y, w.dir)) {
        const k = key(c.x, c.y);
        const cover = byCell.get(k);
        if (cover.length < 2 || seenCells.has(k)) continue;
        seenCells.add(k);
        if (!done.has(k) && links.length < CHAIN.maxLinks) { links.push(k); step.cells.push(k); }
        for (const o of cover) {
          if (!seenWords.has(wordKey(o))) { seenWords.add(wordKey(o)); next.push(o); step.words.push(o.word); }
        }
      }
    }
    if (step.cells.length || step.words.length) steps.push(step);
    frontier = next;
  }
  return { steps, links, points: links.length * CHAIN.pointsPerLink, coins: Math.min(CHAIN.maxCoins, Math.floor(links.length / CHAIN.linksPerCoin)) };
}

/** Serializable event wrapper: the reaction is computed up front; the player collects it once. */
export class ChainEvent {
  constructor({ steps, links, points, coins, collected = false }) {
    this.type = 'chain';
    Object.assign(this, { steps, links, points, coins, collected });
  }

  static create(board, start, claimed) { return new ChainEvent(computeChain(board, start, claimed)); }
  collect() { if (this.collected) return false; this.collected = true; return true; }
  isSolved() { return this.collected; }
  toJSON() { return { type: this.type, steps: this.steps, links: this.links.slice(), points: this.points, coins: this.coins, collected: this.collected }; }
  static fromJSON(j) {
    if (!j || !Array.isArray(j.links) || !Array.isArray(j.steps) || !j.links.every((k) => typeof k === 'string') || !Number.isInteger(j.points) || !Number.isInteger(j.coins)) return null;
    return new ChainEvent({ steps: j.steps, links: j.links.slice(), points: j.points, coins: j.coins, collected: !!j.collected });
  }
}
