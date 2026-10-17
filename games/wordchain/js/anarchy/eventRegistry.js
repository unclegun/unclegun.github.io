import { MODIFIERS } from './modifierRegistry.js';
import { ENCOUNTERS } from './encounterManager.js';
import { LetterCollapse } from './puzzles/letterCollapse.js';
import { TileRepair } from './puzzles/tileRepair.js';
import { GravityShift } from './puzzles/gravity.js';
import { LetterStorm } from './puzzles/letterStorm.js';
import { ChainEvent, computeChain } from './puzzles/chainReaction.js';
import { scaled } from './anarchyScoring.js';

/**
 * Event catalogue. Three kinds share one shape (id, name, icon, tier, weight, minRound, cooldown, eligible, setup, describe):
 *   'modifier'   - changes the rules of upcoming word(s) via hooks (modifierRegistry.js)
 *   'encounter'  - multi-word objective (encounterManager.js)
 *   'interlude'  - a self-contained puzzle played between rounds (this file). Interludes provide:
 *        createPuzzle(ctx, rng) -> puzzle|null   (temporary state; never edits the crossword)
 *        resolve(puzzle, ctx)  -> { coins, score, label }   (reward for a solved puzzle)
 * Events state their prerequisites in `eligible`, so they never start on a board that cannot support them.
 */
const reward = (puzzleDone, coins, score, label, round) => (puzzleDone ? { coins: scaled(coins, round), score: scaled(score, round), label } : { coins: 0, score: 0, label: 'No reward' });

export const INTERLUDES = {
  letter_collapse: {
    id: 'letter_collapse', name: 'Letter Collapse', icon: '🧱', tier: 'minor', kind: 'interlude', weight: 12, minRound: 2, cooldown: 3,
    eligible: (ctx) => !!ctx.lastWord && ctx.lastWord.word.length >= 4,
    setup: () => ({}),
    describe: () => 'The word you just solved crumbles into a tray. Rearrange the tiles into a valid word. Your crossword is safe: only a temporary copy falls.',
    createPuzzle: (ctx, rng) => LetterCollapse.create({ dictionary: ctx.dictionary, word: ctx.lastWord.word, rng, missing: ctx.round >= 6 && (ctx.coins >= 2 || ctx.inventory.wildcardTile > 0) && rng.next() < 0.3 }),
    resolve: (p, ctx) => reward(p.isSolved(ctx.dictionary), 2, 50, 'Letters restored', ctx.round),
  },
  wordquake: {
    id: 'wordquake', name: 'Wordquake', icon: '🌋', tier: 'major', kind: 'interlude', mutation: true, weight: 7, minRound: 5, cooldown: 8, stabilizable: true,
    eligible: (ctx) => ctx.board.words.length >= 3 && TileRepair.supports(ctx.board),
    setup: () => ({}),
    describe: () => 'The ground shakes and a few solved tiles are knocked loose. Swap them back into place to repair the crossword.',
    createPuzzle: (ctx, rng) => TileRepair.create({ board: ctx.board, rng }),
    resolve: (p, ctx) => reward(p.isSolved(), 3 + (p.moves <= p.par + 1 ? 1 : 0), 80, 'Board repaired', ctx.round),
  },
  gravity_shift: {
    id: 'gravity_shift', name: 'Gravity Shift', icon: '🌀', tier: 'major', kind: 'interlude', mutation: true, weight: 6, minRound: 7, cooldown: 9, stabilizable: true,
    eligible: (ctx) => !!ctx.lastWord && ctx.lastWord.word.length >= 4 && ctx.lastWord.word.length <= 7,
    setup: () => ({}),
    describe: () => 'Gravity tilts! Tilt the event board so the tiles slide and settle into the word along the bottom row.',
    createPuzzle: (ctx, rng) => GravityShift.create({ word: ctx.lastWord.word, rng }),
    resolve: (p, ctx) => reward(p.isSolved(), 3 + (p.moves <= p.par + 1 ? 1 : 0), 90, 'Gravity restored', ctx.round),
  },
  letter_storm: {
    id: 'letter_storm', name: 'Letter Storm', icon: '⛈️', tier: 'major', kind: 'interlude', weight: 7, minRound: 4, cooldown: 7,
    eligible: (ctx) => !!ctx.lastWord,
    setup: () => ({}),
    describe: () => 'Letters rain down for a few seconds. Catch letters from your last word; every wrong letter cancels one catch. More net catches, bigger rewards.',
    createPuzzle: (ctx, rng) => LetterStorm.create({ word: ctx.lastWord.word, rng, calm: !!ctx.reduceMotion }),
    resolve(p, ctx) {
      const r = p.finish();
      return { coins: scaled(r.coins, ctx.round), score: scaled(r.score, ctx.round), reveal: r.reveal, label: `Storm: ${r.net} net catches` };
    },
  },
  chain_reaction: {
    id: 'chain_reaction', name: 'Chain Reaction', icon: '⚡', tier: 'minor', kind: 'interlude', weight: 10, minRound: 4, cooldown: 4,
    eligible: (ctx) => !!ctx.lastWord && computeChain(ctx.board, ctx.lastWord, ctx.claimed).links.length >= 2,
    setup: () => ({}),
    describe: () => 'Your new word sparks the crossword: connected intersections light up in a wave. Each intersection pays once per run.',
    createPuzzle: (ctx) => ChainEvent.create(ctx.board, ctx.lastWord, ctx.claimed),
    resolve: (p, ctx) => ({ coins: scaled(p.coins, ctx.round), score: scaled(p.points, ctx.round), label: `Chain of ${p.links.length}`, claim: p.links }),
  },
};

export const EVENTS = { ...MODIFIERS, ...INTERLUDES, ...ENCOUNTERS };
for (const def of Object.values(MODIFIERS)) def.kind = 'modifier';
for (const def of Object.values(ENCOUNTERS)) def.kind = 'encounter';
export const getEvent = (id) => EVENTS[id] || null;
export const listEvents = () => Object.values(EVENTS);
export const TIERS = ['minor', 'major', 'rare'];
