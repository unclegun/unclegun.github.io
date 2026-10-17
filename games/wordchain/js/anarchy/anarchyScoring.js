import { ECONOMY } from './arcadeEconomy.js';

/** Bonus rewards scale gently with progress so late-run events stay meaningful without runaway scores. */
export const rewardScale = (round) => Math.min(1.5, 1 + 0.1 * Math.floor(round / 5));
export const scaled = (n, round) => Math.round(n * rewardScale(round));

/**
 * Combines a solved word's base score with everything active modifiers/encounters add.
 * Modifier hooks return { scoreMult, scoreBonus, coins, items:[{label, points, coins}] }.
 * Returns { scoreBonus, coins, items } where scoreBonus is added on top of the engine's base word score.
 */
export function wordRewards({ baseScore, info, hookResults }) {
  const base = ECONOMY.earn;
  let coins = base.word;
  const items = [{ label: 'Word solved', points: 0, coins: base.word }];
  if (info.attempts <= base.efficientMaxAttempts && !info.hints) { coins += base.efficient; items.push({ label: `Efficient (${info.attempts} guesses)`, points: 0, coins: base.efficient }); }
  if (info.crossings >= 2) { coins += base.multiCross; items.push({ label: 'Multi-crossing', points: 0, coins: base.multiCross }); }
  let mult = 1;
  let bonus = 0;
  let penalty = 0;
  for (const r of hookResults) {
    if (!r) continue;
    if (r.scoreMult && r.scoreMult > 1) mult = Math.max(mult, r.scoreMult); // multipliers do not stack
    bonus += r.scoreBonus || 0;
    penalty += r.penalty || 0;
    coins += r.coins || 0;
    for (const it of r.items || []) items.push(it);
  }
  const multBonus = Math.round(baseScore * (mult - 1));
  if (multBonus > 0) items.push({ label: `Multiplier ×${Math.round(mult * 100) / 100}`, points: multBonus, coins: 0 });
  return { scoreBonus: bonus + multBonus - penalty, coins: Math.max(0, coins), items };
}
