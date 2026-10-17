import { pressureAttempts } from './eventRules.js';
import { scaled } from './anarchyScoring.js';

/**
 * Special encounters: multi-step objectives layered on the normal guessing loop. They use the same hook protocol
 * as modifiers (see modifierRegistry.js) plus:
 *   progress(entry) -> { label, value, max, tone }   for the HUD meter
 * Hooks may mark `entry.data.done = true` (finished) and `entry.data.payout = { coins, score, label }` (to pay).
 * Encounters never replace the engine; they only observe guesses and shape the next word.
 */
const item = (label, points = 0, coins = 0) => ({ label, points, coins });

export const BOSS = { stages: 3, finalLengths: [7, 6] };
export const HEIST = { stages: 4, alarmLimit: 5 };
export const SURVIVAL = { hp: 3, words: 3, safeGuesses: 3, failCoins: 2 };

export const ENCOUNTERS = {
  boss_word: {
    id: 'boss_word', name: 'Boss Word', icon: '👹', tier: 'rare', weight: 4, minRound: 10, cooldown: 16,
    eligible: (ctx) => ctx.round >= 10 && (ctx.hasLength(7) || ctx.hasLength(6)),
    setup: () => ({ stage: 0, stages: BOSS.stages }),
    describe: (e) => `A ${e.data.stages}-stage boss. Each word you solve drains its health. The last stage is a long word under Pressure Cooker rules. Victory pays a big bonus.`,
    hooks: {
      prepare: (e, plan) => { plan.forced = e.data.stage === e.data.stages - 1 ? BOSS.finalLengths.slice() : [5]; },
      attempts: (e, rc) => (e.data.stage === e.data.stages - 1 ? pressureAttempts(rc.known, rc.viable) : null),
      onSolved(e, info, rc) {
        e.data.stage++;
        if (e.data.stage >= e.data.stages) {
          e.data.done = true;
          const c = scaled(8, rc.round);
          const p = scaled(250, rc.round);
          return { coins: c, scoreBonus: p, items: [item('BOSS DEFEATED', p, c)], boss: true };
        }
        return { coins: 1, scoreBonus: 40 * e.data.stage, items: [item(`Boss hit (${e.data.stages - e.data.stage} HP left)`, 40 * e.data.stage, 1)] };
      },
    },
    progress: (e) => ({ label: 'Boss HP', value: e.data.stages - e.data.stage, max: e.data.stages, tone: 'boss' }),
    scope: (e) => `Stage ${Math.min(e.data.stage + 1, e.data.stages)} of ${e.data.stages}`,
  },

  heist: {
    id: 'heist', name: 'Heist', icon: '🕵️', tier: 'major', weight: 5, minRound: 8, cooldown: 12,
    eligible: (ctx) => ctx.round >= 8,
    setup: () => ({ stage: 0, stages: HEIST.stages, alarm: 0, limit: HEIST.alarmLimit, pending: { coins: 0, score: 0 }, failed: false, awaiting: false }),
    describe: (e) => `Up to ${e.data.stages} word challenges. Rewards pile up unbanked. Every unsuccessful guess raises the alarm (limit ${e.data.limit}); if it trips, unbanked heist rewards are lost, but your run continues. Bank after any word to keep what you have.`,
    hooks: {
      choices: (e) => (e.data.awaiting
        ? [{ id: 'bank', label: `Bank ${e.data.pending.coins} coins + ${e.data.pending.score} points`, desc: 'Leave safely with the loot.' }, { id: 'continue', label: 'Keep going', desc: `Bigger rewards, alarm ${e.data.alarm}/${e.data.limit}.` }]
        : [{ id: 'start', label: 'Start the heist', desc: 'Stay quiet. Guess carefully.' }]),
      choose(e, id) {
        if (e.data.awaiting) {
          if (id === 'bank') { e.data.payout = { ...e.data.pending, label: 'Heist banked' }; e.data.pending = { coins: 0, score: 0 }; e.data.done = true; e.data.awaiting = false; return true; }
          if (id === 'continue') { e.data.awaiting = false; return true; }
          return false;
        }
        return id === 'start';
      },
      onGuess(e, info) {
        if (info.solved || e.data.failed) return null;
        e.data.alarm++;
        if (e.data.alarm >= e.data.limit) {
          e.data.failed = true;
          const lost = e.data.pending;
          e.data.pending = { coins: 0, score: 0 };
          return { alarm: true, lost };
        }
        return { alarm: false };
      },
      onSolved(e, info, rc) {
        if (e.data.failed) { e.data.done = true; return { items: [item('Heist failed — unbanked loot lost')] }; }
        e.data.stage++;
        e.data.pending = { coins: e.data.pending.coins + 2 + e.data.stage, score: e.data.pending.score + scaled(60 * e.data.stage, rc.round) };
        if (e.data.stage >= e.data.stages) {
          e.data.done = true;
          const { coins, score } = e.data.pending;
          e.data.pending = { coins: 0, score: 0 };
          return { coins, scoreBonus: score, items: [item('Vault cracked!', score, coins)], heist: true };
        }
        e.data.awaiting = true;
        return { items: [item(`Loot: ${e.data.pending.coins} coins, ${e.data.pending.score} points (unbanked)`)] };
      },
    },
    progress: (e) => ({ label: 'Alarm', value: e.data.alarm, max: e.data.limit, tone: 'danger' }),
    scope: (e) => `Word ${Math.min(e.data.stage + 1, e.data.stages)} of ${e.data.stages} · unbanked ${e.data.pending.coins}🪙`,
  },

  survival: {
    id: 'survival', name: 'Survival', icon: '❤️', tier: 'major', weight: 5, minRound: 6, cooldown: 10,
    eligible: (ctx) => ctx.round >= 6,
    setup: () => ({ hp: SURVIVAL.hp, max: SURVIVAL.hp, wordsLeft: SURVIVAL.words, failed: false }),
    describe: (e) => `Survive ${e.data.wordsLeft} words with ${e.data.max} stability. Each guess beyond the ${SURVIVAL.safeGuesses}rd costs 1 stability; solving in ${SURVIVAL.safeGuesses} or fewer restores 1. At 0 the encounter fails and you lose up to ${SURVIVAL.failCoins} coins.`,
    hooks: {
      onGuess(e, info) {
        if (info.solved || e.data.failed || info.attemptNumber <= SURVIVAL.safeGuesses) return null;
        e.data.hp = Math.max(0, e.data.hp - 1);
        if (e.data.hp === 0) e.data.failed = true;
        return { damage: 1 };
      },
      onSolved(e, info, rc) {
        if (e.data.failed) {
          e.data.done = true;
          const lost = rc.economy.lose(SURVIVAL.failCoins);
          return { items: [item(`Stability lost (-${lost} coins)`)] };
        }
        if (info.attempts <= SURVIVAL.safeGuesses) e.data.hp = Math.min(e.data.max, e.data.hp + 1);
        e.data.wordsLeft--;
        if (e.data.wordsLeft <= 0) {
          e.data.done = true;
          const c = scaled(5, rc.round) + e.data.hp;
          const p = scaled(150, rc.round);
          return { coins: c, scoreBonus: p, items: [item('Survived!', p, c)], survived: true };
        }
        return { items: [item(`Stability ${e.data.hp}/${e.data.max}`)] };
      },
    },
    progress: (e) => ({ label: 'Stability', value: e.data.hp, max: e.data.max, tone: 'life' }),
    scope: (e) => `${e.data.wordsLeft} word${e.data.wordsLeft === 1 ? '' : 's'} to go`,
  },

  risk_reward: {
    id: 'risk_reward', name: 'Risk or Reward', icon: '⚖️', tier: 'major', weight: 6, minRound: 4, cooldown: 6, rerollable: false,
    eligible: (ctx) => ctx.round >= 4,
    setup: () => ({ variant: null }),
    describe: () => 'Choose your challenge. Safe: solve in 5 attempts for a small bonus. Bold: beat a tight limit for triple points and a coin stash, but miss it and you lose 2 coins. Either way, your run is never at stake.',
    hooks: {
      choices: () => [
        { id: 'safe', label: 'Play it safe', desc: 'Solve in 5 or fewer: +30 points, +2 coins.' },
        { id: 'bold', label: 'Go bold', desc: 'Beat the tight limit: ×3 points and +6 coins. Miss: −2 coins.' },
      ],
      choose(e, id) { if (id !== 'safe' && id !== 'bold') return false; e.data.variant = id; return true; },
      goal: (e, rc) => (e.data.variant === 'bold' ? Math.max(3, rc.floor || 2) : e.data.variant === 'safe' ? 5 : null),
      onSolved(e, info, rc) {
        e.data.done = true;
        if (e.data.variant === 'bold') {
          const limit = Math.max(3, rc.floor || 2);
          if (info.attempts <= limit) { const c = scaled(6, rc.round); return { scoreMult: 3, coins: c, items: [item('Bold move paid off', 0, c)] }; }
          const lost = rc.economy.lose(2);
          return { items: [item(`Bold move missed (-${lost} coins)`)] };
        }
        return info.attempts <= 5 ? { coins: 2, scoreBonus: 30, items: [item('Safe and steady', 30, 2)] } : null;
      },
    },
  },
};
