import { readFileSync } from 'node:fs';
import { createDictionary } from '../js/dictionaryService.js';

const read = (f) => readFileSync(new URL('../data/' + f, import.meta.url), 'utf8').split(/\s+/).filter(Boolean);
export const dictionary = createDictionary({ valid: read('valid-guesses.txt'), answers: read('answers.txt') });

/** Dictionary with the 4-, 5-, 6- and 7-letter lists (Wildcard). */
export const wildDictionary = createDictionary({ valid: read('valid-guesses.txt'), answers: read('answers.txt') });
for (const n of [4, 6, 7]) wildDictionary.extend({ valid: read(`valid-guesses-${n}.txt`), answers: read(`answers-${n}.txt`) });
