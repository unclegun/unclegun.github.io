/**
 * Central mode definitions. Everything mode-specific (feature flags, attempts, word lengths,
 * scoring weights, token economy, challenge rules) is configuration read by the shared engine.
 */
export const BASE_ATTEMPTS = 6;

export const TOKEN_ECONOMY = {
  start: 2,
  maxBalance: 12,
  costs: { hint: 2, reroll: 1, extraTry: 3 },
  limits: { hintPerWord: 2, extraTryPerWord: 2, rerollPerRound: 2 }, // extraTryPerWord caps bonus attempts per word
  earn: { efficientMaxAttempts: 3, efficient: 1, multiIntersection: 1, perWordCap: 2 },
};

export const MODES = {
  classic: {
    id: 'classic', name: 'Classic', icon: '🔤', badge: 'The original',
    tagline: 'Five letters, six guesses, endless chain.',
    description: 'The original WordChain. Each solved word is placed on the crossword for you.',
    wordLengths: [5], attempts: BASE_ATTEMPTS,
    features: { selection: false, tokens: false, challenges: false, variableLength: false, precompute: true },
    scoring: 'classic', progression: 'classic',
  },
  builder: {
    id: 'builder', name: 'Builder', icon: '🧱', badge: 'Choose your growth',
    tagline: 'Pick where the crossword grows next.',
    description: 'After each word, choose between Expand, Connect and Junction placements. Fewer known letters score more.',
    wordLengths: [5], attempts: BASE_ATTEMPTS,
    features: { selection: true, tokens: true, challenges: false, variableLength: false, precompute: false },
    scoring: 'builder', progression: 'builder', tokens: TOKEN_ECONOMY,
  },
  architect: {
    id: 'architect', name: 'Architect', icon: '🏛️', badge: 'Structure scores',
    tagline: 'Build dense, connected crosswords.',
    description: 'Score for intersections, junctions and compact shapes. Long thin chains are not rewarded.',
    wordLengths: [5], attempts: BASE_ATTEMPTS,
    features: { selection: true, tokens: true, challenges: false, variableLength: false, precompute: false },
    scoring: 'architect', progression: 'architect', tokens: TOKEN_ECONOMY,
  },
  challenge: {
    id: 'challenge', name: 'Challenge', icon: '🎯', badge: 'Objectives',
    tagline: 'Chase objectives for bonus points.',
    description: 'One objective at a time. Complete it for bonus score and Tokens; the next one adapts to your board.',
    wordLengths: [5], attempts: BASE_ATTEMPTS,
    features: { selection: true, tokens: true, challenges: true, variableLength: false, precompute: false },
    scoring: 'challenge', progression: 'builder', tokens: TOKEN_ECONOMY,
  },
  wildcard: {
    id: 'wildcard', name: 'Wildcard', icon: '🃏', badge: '4–7 letters',
    tagline: 'Words of every length cross the board.',
    description: 'Answers are four to seven letters long and cross words of different lengths. Variety grows with the board.',
    wordLengths: [4, 5, 6, 7], attempts: BASE_ATTEMPTS,
    features: { selection: false, tokens: true, challenges: false, variableLength: true, precompute: false },
    scoring: 'wildcard', progression: 'wildcard', tokens: TOKEN_ECONOMY,
  },
};

export const MODE_ORDER = ['classic', 'builder', 'architect', 'challenge', 'wildcard'];
export const DEFAULT_MODE = 'classic';

export const getMode = (id) => MODES[id] || null;
export const listModes = () => MODE_ORDER.map((id) => MODES[id]);
export const isModeId = (id) => Object.prototype.hasOwnProperty.call(MODES, id);
