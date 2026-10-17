import { LetterCollapse } from './letterCollapse.js';
import { TileRepair } from './tileRepair.js';
import { GravityShift } from './gravity.js';
import { LetterStorm } from './letterStorm.js';
import { MiniSudoku } from './sudoku.js';
import { SlidingLetters } from './sliding.js';
import { MemoryMatch } from './memory.js';
import { ReverseWordle } from './reverseWordle.js';
import { ChainEvent } from './chainReaction.js';

const CLASSES = { collapse: LetterCollapse, repair: TileRepair, gravity: GravityShift, storm: LetterStorm, sudoku: MiniSudoku, sliding: SlidingLetters, memory: MemoryMatch, reverse: ReverseWordle, chain: ChainEvent };

/** Rebuilds any temporary puzzle from its serialized form; null when the data is invalid. */
export function puzzleFromJSON(json) {
  const C = json && CLASSES[json.type];
  try { return C ? C.fromJSON(json) : null; } catch { return null; }
}

/**
 * Registry of optional Puzzle Detours. Add an entry to introduce a new mini-game:
 *   id, name, icon, blurb, reward(round) -> { kind, amount, label }, create({ rng, round, dictionary })
 * Reward kinds: 'coins' | 'reveal' (free letter reveal) | 'guess' (free extra guess).
 */
export const MINIGAMES = {
  sudoku: {
    id: 'sudoku', name: 'Mini Sudoku', icon: '🔢', blurb: 'Fill a 4×4 grid: each row, column and 2×2 box holds 1–4 once.',
    reward: () => ({ kind: 'reveal', amount: 1, label: 'Free letter reveal' }),
    create: ({ rng, round }) => MiniSudoku.create({ rng, round }),
  },
  sliding: {
    id: 'sliding', name: 'Sliding Letters', icon: '🧩', blurb: 'Slide the tiles back into a word, blank in the last cell.',
    reward: (round) => ({ kind: 'coins', amount: round >= 12 ? 4 : 3, label: `${round >= 12 ? 4 : 3} coins` }),
    create: ({ rng, round, dictionary }) => {
      const len = round >= 14 ? 7 : 5;
      return SlidingLetters.create({ word: dictionary.randomAnswer(rng, dictionary.hasLength(len) ? len : 5), rng });
    },
  },
  memory: {
    id: 'memory', name: 'Memory Match', icon: '🧠', blurb: 'Memorize a letter sequence, then rebuild it from memory.',
    reward: () => ({ kind: 'guess', amount: 1, label: 'Free extra guess' }),
    create: ({ rng, round }) => MemoryMatch.create({ rng, round }),
  },
};

export const DETOUR_LIMITS = { perRound: 1, cooldownRounds: 4, perRun: 6 };
export const listMinigames = () => Object.values(MINIGAMES);
