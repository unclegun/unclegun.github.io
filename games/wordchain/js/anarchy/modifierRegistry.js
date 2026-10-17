import { compatible, pressureAttempts, viableCount, MAX_NORMAL_ATTEMPTS } from './eventRules.js';
import { startInfection, canInfect, spread, cleanseByWord, INFECTION } from './puzzles/infection.js';
import { cellsOf, key } from '../placementValidator.js';
import { shuffle } from '../random.js';
import { scaled } from './anarchyScoring.js';

/**
 * Composable round modifiers. Each is registered independently and acts only through hooks; the game
 * never branches on a modifier id. A modifier definition:
 *   id, name, icon, tier ('minor'|'major'|'rare'), weight, minRound, cooldown, rounds, rerollable,
 *   incompatible[], combinable
 *   eligible(ctx) -> boolean
 *   setup(ctx, rng) -> serializable data
 *   describe(entry) -> instruction text shown on the event card
 * hooks (all optional):
 *   attempts(entry, rc)  -> attempt budget wanted for the word (clamped by the fairness floor)
 *   goal(entry, rc)      -> attempt count to beat for a bonus (informational, never ends the run)
 *   choices(entry, ctx)  -> optional player choices on the announcement ([{id,label,desc}])
 *   choose(entry, id, ctx) -> boolean (apply a choice)
 *   onGuess(entry, info, rc) -> optional notes
 *   onSolved(entry, info, rc) -> { scoreMult, scoreBonus, coins, items }
 *   prepare(entry, plan, ctx) -> adjusts the plan for next word selection (e.g. forced length)
 *   mask(entry) -> { hidden: [cellKey], infected: [cellKey] } display-only overlays
 * rc (round context): { round, current, locked, known, viable, dictionary, board, rng, engine }
 */
const VOWELS = new Set('aeiou');
const item = (label, points = 0, coins = 0) => ({ label, points, coins });

const MUTATING_RULES = {
  vowel_coins: { text: 'Vowels pay double: +1 coin for every vowel in the answer (max 4).' },
  yellow_coins: { text: 'Yellow letters pay: +1 coin for each different yellow letter you find (max 4).' },
  first_guess: { text: 'First-guess greens pay: +60 points for 2 new greens on guess one, +120 for 3 or more.' },
  fewer_attempts: { text: 'Speed multiplier: every unused attempt adds +20% to this word’s score (max ×2).' },
  letter_effect: { text: '' },
};

const rulePool = ['vowel_coins', 'yellow_coins', 'first_guess', 'fewer_attempts', 'letter_effect'];

export const MODIFIERS = {
  pressure_cooker: {
    id: 'pressure_cooker', name: 'Pressure Cooker', icon: '🔥', tier: 'minor', weight: 10, minRound: 3, cooldown: 4, rerollable: true, combinable: true,
    eligible: (ctx) => ctx.round >= 3,
    setup: () => ({}),
    describe: () => 'Letters already known from crossings cost you attempts: 0 known → 6, 1 → 5, 2 → 3, 3+ → 2 (never fewer than the puzzle fairly allows).',
    hooks: { attempts: (e, rc) => pressureAttempts(rc.known, rc.viable) },
  },

  shared_pool: {
    id: 'shared_pool', name: 'Shared Guess Pool', icon: '🏊', tier: 'major', weight: 6, minRound: 4, cooldown: 8, rounds: 3, incompatible: ['bet', 'double_trouble', 'wildcard_round'],
    eligible: (ctx) => ctx.round >= 4,
    setup: () => ({ pool: 14, reserve: 3 }),
    describe: (e) => `The next ${e.roundsLeft} words share ${e.data.pool} attempts. Solve efficiently to keep the pool for later; leftover attempts pay coins at the end.`,
    hooks: {
      attempts: (e) => Math.min(MAX_NORMAL_ATTEMPTS, e.data.pool - e.data.reserve * (e.roundsLeft - 1)),
      onSolved(e, info) {
        e.data.pool = Math.max(0, e.data.pool - info.attempts);
        if (e.roundsLeft > 1) return { items: [item(`Pool left: ${e.data.pool} attempts`)] };
        const coins = Math.floor(e.data.pool / 2);
        return coins ? { coins, items: [item(`Pool bonus (${e.data.pool} attempts left)`, 0, coins)] } : null;
      },
    },
    scope: (e) => `${e.data.pool} attempts · ${e.roundsLeft} word${e.roundsLeft === 1 ? '' : 's'}`,
  },

  bet: {
    id: 'bet', name: 'Bet Your Guesses', icon: '🎰', tier: 'minor', weight: 7, minRound: 3, cooldown: 5, rerollable: true, incompatible: ['shared_pool'],
    eligible: (ctx) => ctx.round >= 3 && ctx.coins >= 2,
    setup: () => ({ wager: 0, within: 0 }),
    describe: () => 'Optionally wager coins on solving within a number of attempts. Win: you get double your wager back as profit plus bonus points. Lose: you lose the wager. Skipping costs nothing.',
    hooks: {
      choices: (e, ctx) => [
        { id: 'skip', label: 'No wager', desc: 'Play normally.' },
        ...[[2, 4], [3, 3], [5, 2]].filter(([c]) => ctx.coins >= c).map(([c, w]) => ({ id: `wager:${c}:${w}`, label: `Wager ${c} coins`, desc: `Solve in ${w} or fewer attempts to win ${c * 2} coins.` })),
      ],
      choose(e, id, ctx) {
        if (id === 'skip') { e.data.wager = 0; return true; }
        const m = /^wager:(\d+):(\d+)$/.exec(id);
        if (!m) return false;
        const [c, w] = [Number(m[1]), Number(m[2])];
        if (ctx.coins < c) return false;
        e.data.wager = c;
        e.data.within = w;
        return true;
      },
      goal: (e) => (e.data.wager ? e.data.within : null),
      onSolved(e, info, rc) {
        if (!e.data.wager) return null;
        if (info.attempts <= e.data.within) return { coins: e.data.wager * 2, scoreBonus: 40 * e.data.wager, items: [item(`Bet won (${e.data.wager} coins)`, 40 * e.data.wager, e.data.wager * 2)] };
        const lost = rc.economy.lose(e.data.wager);
        return { items: [item(`Bet lost (-${lost} coins)`)] };
      },
    },
  },

  jackpot: {
    id: 'jackpot', name: 'Jackpot Round', icon: '💰', tier: 'major', weight: 5, minRound: 6, cooldown: 8, rerollable: true, combinable: true,
    eligible: (ctx) => ctx.round >= 6,
    setup: () => ({}),
    describe: () => 'Solve within the jackpot limit for triple word points and a coin hoard. Miss it and you simply play on with your normal attempts, no penalty.',
    hooks: {
      goal: (e, rc) => Math.max(rc.known >= 1 ? 3 : 4, rc.floor || 2),
      onSolved(e, info, rc) {
        const limit = Math.max(rc.known >= 1 ? 3 : 4, rc.floor || 2);
        if (info.attempts > limit) return { items: [item('Jackpot missed')] };
        const c = scaled(6, rc.round);
        return { scoreMult: 3, coins: c, items: [item(`JACKPOT! (≤${limit} attempts)`, 0, c)], jackpot: true };
      },
    },
  },

  mutating_rules: {
    id: 'mutating_rules', name: 'Rule Roulette', icon: '🎡', tier: 'minor', weight: 9, minRound: 2, cooldown: 3, rerollable: true, combinable: true, roulette: true,
    eligible: (ctx) => ctx.round >= 2,
    setup: (ctx, rng) => {
      const rule = rulePool[rng.int(rulePool.length)];
      return { rule, letter: rule === 'letter_effect' ? 'aeiorstln'[rng.int(9)] : null };
    },
    describe: (e) => (e.data.rule === 'letter_effect'
      ? `Lucky letter ${e.data.letter.toUpperCase()}: if it is in the answer, +1 coin and +15 points per copy.`
      : MUTATING_RULES[e.data.rule].text) + ' Wordle feedback itself never changes.',
    hooks: {
      onSolved(e, info, rc) {
        const word = rc.current.word;
        const unknownIdx = [...word].map((l, i) => (rc.locked[i] ? -1 : i)).filter((i) => i >= 0);
        switch (e.data.rule) {
          case 'vowel_coins': {
            const n = Math.min(4, unknownIdx.filter((i) => VOWELS.has(word[i])).length);
            return n ? { coins: n, items: [item(`Vowel coins (${n})`, 0, n)] } : null;
          }
          case 'yellow_coins': {
            const seen = new Set();
            for (const g of info.guesses.slice(0, -1)) g.result.forEach((r, i) => { if (r === 'present') seen.add(g.word[i]); });
            const n = Math.min(4, seen.size);
            return n ? { coins: n, items: [item(`Yellow letters (${n})`, 0, n)] } : null;
          }
          case 'first_guess': {
            const g = info.guesses[0];
            const greens = g ? g.result.filter((r, i) => r === 'correct' && !rc.locked[i]).length : 0;
            const pts = greens >= 3 ? 120 : greens >= 2 ? 60 : 0;
            return pts ? { scoreBonus: pts, items: [item(`First-guess greens (${greens})`, pts)] } : null;
          }
          case 'fewer_attempts': {
            const mult = Math.min(2, 1 + 0.2 * Math.max(0, MAX_NORMAL_ATTEMPTS - info.attempts));
            return mult > 1 ? { scoreMult: mult, items: [] } : null;
          }
          default: {
            const n = [...word].filter((l) => l === e.data.letter).length;
            return n ? { coins: 1, scoreBonus: 15 * n, items: [item(`Lucky ${e.data.letter.toUpperCase()} ×${n}`, 15 * n, 1)] } : null;
          }
        }
      },
    },
  },

  blackout: {
    id: 'blackout', name: 'Blackout', icon: '🌑', tier: 'minor', weight: 6, minRound: 5, cooldown: 6, rerollable: true, combinable: true,
    eligible: (ctx) => ctx.board.words.length >= 4,
    setup: (ctx, rng) => {
      const keys = shuffle([...ctx.board.cells.keys()], rng);
      return { hidden: keys.slice(0, Math.max(3, Math.floor(keys.length * 0.4))) };
    },
    describe: () => 'Some solved letters on the crossword are hidden for this word. Nothing is lost: the real board is untouched and returns when the round ends. Play blind for bonus coins.',
    hooks: {
      mask: (e, rc) => ({ hidden: e.data.hidden.filter((k) => !(rc && rc.crossingKeys && rc.crossingKeys.includes(k))) }),
      onSolved: (e, info, rc) => { const c = scaled(2, rc.round); return { coins: c, items: [item('Played blind', 0, c)] }; },
    },
  },

  wildcard_round: {
    id: 'wildcard_round', name: 'Wildcard Round', icon: '🃏', tier: 'minor', weight: 8, minRound: 3, cooldown: 4, combinable: true, incompatible: ['shared_pool', 'double_trouble'],
    eligible: (ctx) => ctx.round >= 3 && [4, 6, 7].some((n) => ctx.hasLength(n)),
    setup: (ctx, rng) => {
      const lens = [4, 6, 7].filter((n) => ctx.hasLength(n));
      return { length: lens[rng.int(lens.length)] };
    },
    describe: (e) => `The next word has ${e.data.length} letters.`,
    hooks: {
      prepare: (e, plan) => { plan.forced = [e.data.length]; },
      onSolved: (e, info, rc) => { const p = scaled(Math.abs(e.data.length - 5) * 30 + 30, rc.round); return { scoreBonus: p, items: [item(`${e.data.length}-letter bonus`, p)] }; },
    },
  },

  reverse_wordle: {
    id: 'reverse_wordle', name: 'Reverse Wordle', icon: '🔎', tier: 'major', weight: 6, minRound: 4, cooldown: 7, incompatible: ['shared_pool', 'bet', 'jackpot', 'pressure_cooker'],
    eligible: (ctx) => ctx.round >= 4,
    setup: () => ({}),
    describe: () => 'No guessing this time: study the Wordle clues and deduce the one answer that explains all of them. Three tries; if you miss, the word becomes an ordinary round.',
    hooks: {
      onSolved: (e, info, rc) => { const c = scaled(3, rc.round); return { coins: c, scoreBonus: scaled(80, rc.round), items: [item('Deduction', scaled(80, rc.round), c)] }; },
    },
  },

  double_trouble: {
    id: 'double_trouble', name: 'Double Trouble', icon: '🔗', tier: 'major', weight: 5, minRound: 5, cooldown: 9, incompatible: ['shared_pool', 'wildcard_round', 'blackout', 'pressure_cooker', 'jackpot', 'reverse_wordle', 'word_infection'],
    eligible: (ctx) => ctx.round >= 5 && ctx.board.words.length >= 2,
    setup: () => ({ stage: 'A', budget: 9, used: 0, second: null }),
    describe: (e) => `Two linked words share ${e.data.budget} attempts. Solve the first and its crossing letter is locked into the second.`,
    hooks: {
      attempts: (e, rc) => (e.data.stage === 'A' ? MAX_NORMAL_ATTEMPTS : Math.max(3, e.data.budget - e.data.used)),
      onSolved(e, info, rc) {
        if (e.data.stage === 'A') return { items: [item('First word down — second word unlocked')] };
        const c = scaled(4, rc.round);
        return { coins: c, scoreBonus: scaled(100, rc.round), items: [item('Double Trouble cleared', scaled(100, rc.round), c)] };
      },
    },
    scope: (e) => `Word ${e.data.stage === 'A' ? 1 : 2} of 2 · ${Math.max(0, e.data.budget - e.data.used)} attempts in budget`,
  },

  word_infection: {
    id: 'word_infection', name: 'Word Infection', icon: '🦠', tier: 'major', weight: 5, minRound: 6, cooldown: 9, rounds: INFECTION.rounds, mutation: true, incompatible: ['double_trouble'],
    eligible: (ctx) => canInfect(ctx.board) && ctx.round >= 6,
    setup: (ctx, rng) => startInfection(ctx.board, rng),
    describe: (e) => `Corruption has taken ${e.data.cells.length} crossword cells. Every second unsuccessful guess spreads it (max ${e.data.cap}). Solve a word crossing an infected cell to cleanse it, or Cleanse for ${INFECTION.cleanseCost} coins/Stabilizer. Leftover infection after ${e.roundsLeft} words costs ${INFECTION.penaltyPerCell} points per cell.`,
    hooks: {
      onGuess(e, info, rc) {
        if (info.solved) return null;
        const k = spread(e.data, rc.board, rc.rng);
        return k ? { spread: k } : null;
      },
      onSolved(e, info, rc) {
        const placed = rc.placed ? cellsOf(rc.placed.word, rc.placed.x, rc.placed.y, rc.placed.dir).map((c) => key(c.x, c.y)) : [];
        const cleared = cleanseByWord(e.data, placed);
        const items = [];
        let coins = 0;
        if (cleared.length) { coins += cleared.length; items.push(item(`Cleansed ${cleared.length} cell${cleared.length > 1 ? 's' : ''}`, 0, cleared.length)); }
        let penalty = 0;
        if (e.roundsLeft <= 1) {
          if (e.data.cells.length) { penalty = e.data.cells.length * INFECTION.penaltyPerCell; items.push(item(`Infection remains (${e.data.cells.length})`, -penalty)); e.data.cells = []; }
          else { coins += 3; items.push(item('Fully cleansed', 0, 3)); }
        }
        return { coins, scoreBonus: 0, penalty, items };
      },
      mask: (e) => ({ infected: e.data.cells.slice() }),
    },
    scope: (e) => `${e.data.cells.length} infected · ${e.roundsLeft} word${e.roundsLeft === 1 ? '' : 's'} left`,
  },
};

/** Hook helpers: run a hook across active entries (modifiers only). */
export const defOf = (entry) => MODIFIERS[entry.id];

export function modifierEntries(entries) {
  return entries.filter((e) => e.kind === 'modifier' && MODIFIERS[e.id] && ['active', 'announced', 'selected'].includes(e.stage));
}

export { compatible, viableCount };
