import { H, V, validatePlacement } from './placementValidator.js';
import { CrosswordBoard } from './crosswordGenerator.js';
import { MAX_ATTEMPTS } from './gameEngine.js';
import { CORRECT } from './wordleEvaluator.js';
import { getMode } from './gameModes.js';
import { ResourceManager } from './resourceManager.js';
import { ChallengeManager } from './challengeManager.js';
import { validateAnarchyState } from './anarchy/anarchyState.js';

export const SAVE_VERSION = 2;
const isWord = (w, mode) => typeof w === 'string' && /^[a-z]+$/.test(w) && mode.wordLengths.includes(w.length);
const isPlacement = (p, mode) => p && isWord(p.word, mode) && Number.isInteger(p.x) && Number.isInteger(p.y) && (p.dir === H || p.dir === V);

/**
 * Returns a sanitized state if `s` is a structurally and logically consistent save
 * (board replays legally, counts agree, current word fits, resources/objectives are sane), else null.
 * Version 1 saves are Classic saves; version 2 saves carry their mode. Never throws.
 * A save whose words use lengths missing from `dictionary` is rejected.
 */
export function validateSave(s, dictionary, expectedMode = null) {
  try {
    if (!s || (s.version !== 1 && s.version !== 2)) return null;
    const mode = getMode(s.version === 1 ? 'classic' : s.mode);
    if (!mode || (expectedMode && mode.id !== expectedMode)) return null;
    if (s.version === 1 && Object.keys(s).includes('mode') && s.mode !== 'classic') return null;
    if (mode.features.variableLength && !mode.wordLengths.every((n) => dictionary.hasLength(n))) return null;
    if (!Number.isFinite(s.seed) || !Number.isFinite(s.rng)) return null;
    if (!Number.isInteger(s.score) || s.score < 0 || !Number.isInteger(s.solved) || s.solved < 0) return null;
    if (!['playing', 'lost', 'complete'].includes(s.status) || !['guessing', 'solved', 'choosing'].includes(s.phase)) return null;
    if (s.phase === 'choosing' && (!mode.features.selection || s.status !== 'playing')) return null;
    if (!Array.isArray(s.words) || s.words.length !== s.solved || !s.words.every((w) => isPlacement(w, mode))) return null;
    const extra = s.extra ?? 0;
    const hints = s.hints ?? {};
    const cap = mode.tokens ? mode.tokens.limits.extraTryPerWord : mode.anarchy ? mode.anarchy.maxExtra : 0;
    if (!Number.isInteger(extra) || extra < 0 || extra > cap) return null;
    if (!Array.isArray(s.guesses) || s.guesses.length > (mode.anarchy ? mode.anarchy.maxGuesses : MAX_ATTEMPTS + extra)) return null;
    const len = s.current?.word?.length;
    for (const g of s.guesses) {
      if (!g || !isWord(g.word, mode) || !Array.isArray(g.result) || g.result.length !== g.word.length || (len && g.word.length !== len)) return null;
    }
    if (s.history !== undefined && !Array.isArray(s.history)) return null;
    const board = new CrosswordBoard();
    for (const [i, w] of s.words.entries()) {
      if (board.has(w.word)) return null;
      if (i > 0 && !validatePlacement(board, w.word, w.x, w.y, w.dir).ok) return null;
      board.addWord(w.word, w.x, w.y, w.dir);
    }
    if (s.status === 'playing' && s.phase !== 'choosing') {
      if (!isPlacement(s.current, mode) || (s.phase !== 'solved' && board.has(s.current.word))) return null;
      if (s.phase === 'guessing') {
        if (s.words.length > 0 && !validatePlacement(board, s.current.word, s.current.x, s.current.y, s.current.dir).ok) return null;
        if (s.guesses.some((g) => g.result.every((r) => r === CORRECT))) return null;
        for (const [i, l] of Object.entries(hints)) {
          if (!(Number(i) < s.current.word.length) || s.current.word[i] !== l) return null;
        }
        if (Object.keys(hints).length > (mode.tokens ? mode.tokens.limits.hintPerWord : mode.anarchy ? mode.anarchy.maxHints : 0)) return null;
      } else {
        const last = s.words[s.words.length - 1];
        if (!last || last.word !== s.current.word) return null;
      }
    }
    if (s.phase === 'choosing') {
      if (!Array.isArray(s.options) || !s.options.length || s.options.length > 3) return null;
      if (Object.keys(hints).length || extra) return null;
      for (const o of s.options) {
        if (!isPlacement(o, mode) || board.has(o.word) || !validatePlacement(board, o.word, o.x, o.y, o.dir).ok) return null;
        if (!dictionary.isAnswer(o.word)) return null;
      }
      if (new Set(s.options.map((o) => o.word)).size !== s.options.length) return null;
    }
    if (mode.features.tokens && !ResourceManager.isValidState(s.resources, mode.tokens)) return null;
    if (mode.features.anarchy && !validateAnarchyState(s.anarchy, s)) return null;
    if (mode.features.challenges && !ChallengeManager.isValidState(s.challenges)) return null;
    return s;
  } catch { return null; }
}
