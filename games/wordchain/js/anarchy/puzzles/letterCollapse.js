import { shuffle } from '../../random.js';

const sortLetters = (w) => [...w].sort().join('');

/** Other valid answers that use exactly the same letters. */
export function findAnagrams(dictionary, word) {
  const key = sortLetters(word);
  return dictionary.answersOf(word.length).filter((w) => w !== word && sortLetters(w) === key);
}

/**
 * Letter Collapse: the letters of a solved word fall into a tray in a scrambled order.
 * The player rearranges tiles until the slots spell any valid word (the original always works).
 * Optional `missing` variant: one tile is absent (a blank slot); it can be supplied with a Wildcard Tile
 * or coins, which places the correct letter. Operates only on this temporary state, never on the crossword.
 */
export class LetterCollapse {
  constructor({ word, slots, missing = null, filled = false, moves = 0 }) {
    this.type = 'collapse';
    this.word = word;
    this.slots = slots; // letters (or '' for the blank)
    this.missing = missing; // index in `word` of the absent letter, or null
    this.filled = filled;
    this.moves = moves;
  }

  static create({ dictionary, word, rng, missing = false }) {
    const letters = [...word];
    let arranged = null;
    for (let tries = 0; tries < 60 && !arranged; tries++) {
      const s = shuffle(letters, rng);
      if (s.join('') !== word && !dictionary.isValidGuess(s.join(''))) arranged = s;
    }
    if (!arranged) arranged = [...letters.slice(1), letters[0]]; // always differs unless the word is one repeated letter
    let missingIndex = null;
    const slots = arranged.slice();
    if (missing && word.length >= 5) {
      const at = rng.int(slots.length);
      missingIndex = word.indexOf(slots[at]);
      slots[at] = '';
    }
    return new LetterCollapse({ word, slots, missing: missingIndex });
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

  /** Supplies the missing letter (cost handled by the caller after this returns true). */
  fillMissing() {
    if (this.missing === null || this.filled || !this.hasBlank) return false;
    this.slots[this.slots.indexOf('')] = this.word[this.missing];
    this.filled = true;
    return true;
  }

  isSolved(dictionary) { return !this.hasBlank && dictionary.isValidGuess(this.arrangement); }

  toJSON() { return { type: this.type, word: this.word, slots: this.slots.slice(), missing: this.missing, filled: this.filled, moves: this.moves }; }

  static fromJSON(j) {
    if (!j || typeof j.word !== 'string' || !Array.isArray(j.slots) || j.slots.length !== j.word.length) return null;
    if (!j.slots.every((l) => typeof l === 'string' && /^[a-z]?$/.test(l))) return null;
    if (sortLetters(j.slots.join('')) !== sortLetters(j.word) && j.missing === null) return null;
    return new LetterCollapse(j);
  }
}
