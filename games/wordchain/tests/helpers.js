import { readFileSync } from 'node:fs';
import { createDictionary } from '../js/dictionaryService.js';

const read = (f) => readFileSync(new URL('../data/' + f, import.meta.url), 'utf8').split(/\s+/).filter(Boolean);
export const dictionary = createDictionary({ valid: read('valid-guesses.txt'), answers: read('answers.txt') });
