import { H, V, WORD_LENGTH, validatePlacement } from './placementValidator.js';
import { CrosswordBoard } from './crosswordGenerator.js';
import { MAX_ATTEMPTS } from './gameEngine.js';
import { CORRECT } from './wordleEvaluator.js';

export const SAVE_VERSION = 1;
const isWord = (w) => typeof w === 'string' && /^[a-z]{5}$/.test(w);
const isPlacement = (p) => p && isWord(p.word) && Number.isInteger(p.x) && Number.isInteger(p.y) && (p.dir === H || p.dir === V);

/**
 * Returns a sanitized state if `s` is a structurally and logically consistent save
 * (board replays legally, counts agree, current word fits), else null. Never throws.
 */
export function validateSave(s, dictionary) {
  try {
    if (!s || s.version !== SAVE_VERSION) return null;
    if (!Number.isFinite(s.seed) || !Number.isFinite(s.rng)) return null;
    if (!Number.isInteger(s.score) || s.score < 0 || !Number.isInteger(s.solved) || s.solved < 0) return null;
    if (!['playing', 'lost', 'complete'].includes(s.status) || !['guessing', 'solved'].includes(s.phase)) return null;
    if (!Array.isArray(s.words) || s.words.length !== s.solved || !s.words.every(isPlacement)) return null;
    if (!Array.isArray(s.guesses) || s.guesses.length > MAX_ATTEMPTS) return null;
    for (const g of s.guesses) {
      if (!g || !isWord(g.word) || !Array.isArray(g.result) || g.result.length !== WORD_LENGTH) return null;
    }
    const board = new CrosswordBoard();
    for (const [i, w] of s.words.entries()) {
      if (board.has(w.word)) return null;
      if (i > 0 && !validatePlacement(board, w.word, w.x, w.y, w.dir).ok) return null;
      board.addWord(w.word, w.x, w.y, w.dir);
    }
    if (s.status === 'playing') {
      if (!isPlacement(s.current) || (s.phase !== 'solved' && board.has(s.current.word))) return null;
      if (s.phase === 'guessing') {
        if (s.words.length > 0 && !validatePlacement(board, s.current.word, s.current.x, s.current.y, s.current.dir).ok) return null;
        if (s.guesses.some((g) => g.result.every((r) => r === CORRECT))) return null;
      } else {
        const last = s.words[s.words.length - 1];
        if (!last || last.word !== s.current.word) return null;
      }
    }
    return s;
  } catch { return null; }
}
