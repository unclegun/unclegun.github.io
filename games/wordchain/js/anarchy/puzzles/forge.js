import { shuffle } from '../../random.js';

const sortLetters = (w) => [...w].sort().join('');
const ALPHA = 'abcdefghijklmnopqrstuvwxyz';
const MAX_SOLUTIONS = 8;
const indexCache = new WeakMap();

/** Sorted-letters -> answers index, built once per dictionary and length (bounded by the word list size). */
function anagramIndex(dictionary, len) {
  let byLen = indexCache.get(dictionary);
  if (!byLen) indexCache.set(dictionary, (byLen = new Map()));
  const words = dictionary.answersOf(len);
  let entry = byLen.get(len);
  if (!entry || entry.words !== words || entry.size !== words.length) {
    const map = new Map();
    for (const w of words) { const k = sortLetters(w); (map.get(k) || map.set(k, []).get(k)).push(w); }
    entry = { words, size: words.length, map };
    byLen.set(len, entry);
  }
  return entry.map;
}

/** Distinct answers built from exactly the same letters. */
export const findAnagrams = (dictionary, word) => (anagramIndex(dictionary, word.length).get(sortLetters(word)) || []).filter((w) => w !== word).sort();

/** Distinct answers reached by replacing exactly one letter: [{ word, index, letter }]. At most 26 * length lookups. */
export function findSubstitutions(dictionary, word) {
  const out = [];
  for (let i = 0; i < word.length; i++) {
    for (const c of ALPHA) {
      if (c === word[i]) continue;
      const w = word.slice(0, i) + c + word.slice(i + 1);
      if (dictionary.isAnswer(w)) out.push({ word: w, index: i, letter: c });
    }
  }
  return out;
}

export const REWARD_KINDS = ['startHint', 'freeGuess', 'shield'];

/**
 * Letter Forge: the solved word's tiles fall into a tray and the player forges a DIFFERENT word.
 * Variants (all use only temporary state; the crossword is never touched):
 *   anagram - rearrange the same letters into another word
 *   swap    - exchange one tile with a spare tile to make another word
 *   missing - one tile is absent; supply it with a Wildcard Tile or coins, then build another word
 * Any valid word other than the original is accepted. `solutions` lists the intended ones; different
 * solutions award different next-round benefits, and any other valid word awards the smallest one.
 */
export class LetterForge {
  constructor({ variant, word, slots, spares = [], solutions, missingLetter = null, filled = false, moves = 0, difficulty = 1 }) {
    this.type = 'forge';
    this.variant = variant;
    this.word = word;
    this.slots = slots;
    this.spares = spares;
    this.solutions = solutions;
    this.missingLetter = missingLetter;
    this.filled = filled;
    this.moves = moves;
    this.difficulty = difficulty;
  }

  /** Cheap check: does the dictionary offer any fair distinct target for this word? */
  static supports(dictionary, word) {
    return !!word && word.length >= 4 && word.length <= 7 && (findAnagrams(dictionary, word).length > 0 || findSubstitutions(dictionary, word).length > 0);
  }

  /** Builds a forge for `word`, or null when the dictionary supports no fair, distinct target. Deterministic for a given rng. */
  static create({ dictionary, word, rng, allowMissing = false, round = 1 }) {
    if (!word || word.length < 4 || word.length > 7) return null;
    const anagrams = findAnagrams(dictionary, word);
    const subs = findSubstitutions(dictionary, word);
    const options = [];
    if (anagrams.length) options.push('anagram');
    if (subs.length) options.push('swap');
    if (subs.length && allowMissing) options.push('missing');
    if (!options.length) return null;
    const variant = options[rng.int(options.length)];
    const letters = [...word];
    const notWord = (arr) => !dictionary.isValidGuess(arr.join('')) && arr.join('') !== word;
    const scramble = (arr) => {
      for (let t = 0; t < 40; t++) { const s = shuffle(arr, rng); if (notWord(s)) return s; }
      return null;
    };
    if (variant === 'anagram') {
      const slots = scramble(letters);
      if (!slots) return null;
      return new LetterForge({ variant, word, slots, solutions: anagrams.slice(0, MAX_SOLUTIONS), difficulty: 1 + (round >= 8 ? 1 : 0) });
    }
    const pick = subs[rng.int(subs.length)];
    if (variant === 'swap') {
      // Tray keeps the word's order; the spares are the replacement letter plus one decoy.
      const decoy = ALPHA[rng.int(26)];
      const spares = shuffle([pick.letter, decoy === pick.letter ? 'e' : decoy], rng);
      const reachable = subs.filter((s) => spares.includes(s.letter)).map((s) => s.word);
      const solutions = [...new Set([pick.word, ...reachable])].slice(0, MAX_SOLUTIONS);
      return new LetterForge({ variant, word, slots: letters.slice(), spares, solutions, difficulty: 2 });
    }
    // missing: remove the letter that the target replaces, then scramble what remains with a blank
    const rest = letters.filter((_, i) => i !== pick.index);
    const slots = shuffle([...rest, ''], rng);
    return new LetterForge({ variant, word, slots, solutions: [pick.word], missingLetter: pick.letter, difficulty: 3 });
  }

  get length() { return this.slots.length; }
  get arrangement() { return this.slots.join(''); }
  get hasBlank() { return this.slots.includes(''); }

  swap(i, j) {
    if (!Number.isInteger(i) || !Number.isInteger(j) || i === j || i < 0 || j < 0 || i >= this.length || j >= this.length) return false;
    [this.slots[i], this.slots[j]] = [this.slots[j], this.slots[i]];
    this.moves++;
    return true;
  }

  /** Exchange a tray slot with a spare tile (swap variant). */
  exchange(i, k) {
    if (this.variant !== 'swap' || !Number.isInteger(i) || !Number.isInteger(k) || i < 0 || i >= this.length || k < 0 || k >= this.spares.length) return false;
    [this.slots[i], this.spares[k]] = [this.spares[k], this.slots[i]];
    this.moves++;
    return true;
  }

  /** Supplies the absent tile (cost handled by the caller after this returns true). */
  fillMissing() {
    if (this.variant !== 'missing' || this.filled || !this.hasBlank) return false;
    this.slots[this.slots.indexOf('')] = this.missingLetter;
    this.filled = true;
    return true;
  }

  isSolved(dictionary) { return !this.hasBlank && this.arrangement !== this.word && dictionary.isValidGuess(this.arrangement); }

  /** The forged word's reward kind. Intended solutions map to different benefits; other valid words give the smallest. */
  rewardKind(dictionary) {
    if (!this.isSolved(dictionary)) return null;
    const i = this.solutions.indexOf(this.arrangement);
    if (i < 0) return 'solveBonus';
    return REWARD_KINDS[i % REWARD_KINDS.length];
  }

  /** Tile data for a wildcard use: only the number of valid constructions is disclosed, never the words. */
  get choices() { return this.solutions.length; }

  toJSON() {
    return { type: this.type, variant: this.variant, word: this.word, slots: this.slots.slice(), spares: this.spares.slice(), solutions: this.solutions.slice(), missingLetter: this.missingLetter, filled: this.filled, moves: this.moves, difficulty: this.difficulty };
  }

  static fromJSON(j) {
    if (!j || !['anagram', 'swap', 'missing'].includes(j.variant) || typeof j.word !== 'string' || !/^[a-z]{4,7}$/.test(j.word)) return null;
    const lets = (a) => Array.isArray(a) && a.every((l) => typeof l === 'string' && /^[a-z]?$/.test(l));
    if (!lets(j.slots) || !lets(j.spares) || j.slots.length !== j.word.length || j.spares.length > 2) return null;
    if (!Array.isArray(j.solutions) || !j.solutions.length || !j.solutions.every((w) => typeof w === 'string' && /^[a-z]+$/.test(w))) return null;
    if (j.variant === 'missing' && !(typeof j.missingLetter === 'string' && /^[a-z]$/.test(j.missingLetter))) return null;
    const blanks = j.slots.filter((l) => l === '').length;
    if (j.variant === 'swap' ? j.spares.length < 1 || blanks : j.spares.length || (j.variant === 'missing' ? blanks !== (j.filled ? 0 : 1) : blanks)) return null;
    return new LetterForge({ ...j, moves: Number.isInteger(j.moves) ? j.moves : 0, difficulty: [1, 2, 3].includes(j.difficulty) ? j.difficulty : 1 });
  }
}
