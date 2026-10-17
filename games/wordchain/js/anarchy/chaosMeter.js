/**
 * Chaos Meter: Anarchy-only pacing resource. Pure functions over a small serializable state
 * { value, wordsSinceMajor, plainStreak, catalyst, majors }. All balancing lives in CHAOS.
 */
export const CHAOS = {
  max: 100,
  threshold: 100,
  gains: { word: 22, efficient: 10, perCrossing: 6, crossingCap: 3, hard: 8, eventDone: 10 },
  startValue: 10,
  maxPlainStreak: 2, // after this many consecutive plain rounds a minor modifier is forced
  firstMajorBy: 4, // a major event is guaranteed once this many words were solved without one
  catalystGain: 30,
  catalystBonusCoins: 3,
  brakeDrop: 35,
};

export const newChaosState = () => ({ value: CHAOS.startValue, wordsSinceMajor: 0, plainStreak: 0, catalyst: false, majors: 0 });

export function isValidChaosState(c) {
  const n = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;
  return !!c && n(c.value, CHAOS.max) && n(c.wordsSinceMajor, 1000) && n(c.plainStreak, 1000) && typeof c.catalyst === 'boolean' && n(c.majors, 1000);
}

const clamp = (v, config) => Math.max(0, Math.min(config.max, Math.round(v)));

/** Chaos earned by a solved word. info: { attempts, crossings, hard, attemptLimit } */
export function wordGain(info, config = CHAOS) {
  const g = config.gains;
  let n = g.word;
  if (info.attempts <= 3) n += g.efficient;
  n += Math.min(info.crossings || 0, g.crossingCap) * g.perCrossing;
  if (info.hard) n += g.hard;
  return n;
}

export function add(state, amount, config = CHAOS) {
  state.value = clamp(state.value + amount, config);
  return state.value;
}

export function onWordSolved(state, info, config = CHAOS) {
  state.wordsSinceMajor++;
  return add(state, wordGain(info, config), config);
}

export function ready(state, config = CHAOS) {
  return state.value >= config.threshold || state.wordsSinceMajor >= config.firstMajorBy;
}

/** 'major' when the meter is full, 'minor' when plain rounds ran too long, otherwise null (director decides). */
export function nextKind(state, config = CHAOS) {
  if (ready(state, config)) return 'major';
  if (state.plainStreak >= config.maxPlainStreak) return 'minor';
  return null;
}

export function recordPick(state, tier) {
  if (tier === 'major' || tier === 'rare') { state.value = 0; state.wordsSinceMajor = 0; state.plainStreak = 0; state.majors++; }
  else if (tier === 'minor') state.plainStreak = 0;
  else state.plainStreak++;
}

export function catalyst(state, config = CHAOS) { state.catalyst = true; return add(state, config.catalystGain, config); }
export function brake(state, config = CHAOS) { state.wordsSinceMajor = Math.max(0, state.wordsSinceMajor - 1); return add(state, -config.brakeDrop, config); }
export const percent = (state, config = CHAOS) => Math.round((state.value / config.threshold) * 100);
export const nearlyFull = (state, config = CHAOS) => state.value >= config.threshold * 0.75;
