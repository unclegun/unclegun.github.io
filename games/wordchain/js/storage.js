/**
 * localStorage persistence, independent of the renderer. Every mode has its own save, best score and stats.
 * Classic keeps reading the original (v1) keys so existing saves and high scores survive the upgrade.
 * All functions accept an optional storage object (defaults to localStorage) for testing.
 */
const LEGACY_SAVE_KEY = 'wordchain.save.v1';
const LEGACY_BEST_KEY = 'wordchain.best.v1';
const k = (what, mode) => `wordchain.v2.${what}.${mode}`;
const META_KEY = 'wordchain.v2.meta';

function store(s) {
  if (s) return s;
  try { return globalThis.localStorage || null; } catch { return null; }
}

const readJson = (s, key) => {
  try { return JSON.parse(store(s)?.getItem(key) || 'null'); } catch { return null; }
};
const writeJson = (s, key, value) => {
  try { store(s)?.setItem(key, JSON.stringify(value)); } catch { /* ignore quota/private mode */ }
};
const remove = (s, key) => {
  try { store(s)?.removeItem(key); } catch { /* ignore */ }
};

const validSave = (data, mode) => !!data && (data.version === 1 ? mode === 'classic' : data.version === 2 && data.mode === mode);

export function saveRun(mode, state, s) {
  writeJson(s, k('save', mode), state);
  if (mode === 'classic') remove(s, LEGACY_SAVE_KEY); // migrated
}

export function loadRun(mode, s) {
  const data = readJson(s, k('save', mode));
  if (validSave(data, mode)) return data;
  if (mode === 'classic') {
    const legacy = readJson(s, LEGACY_SAVE_KEY);
    if (validSave(legacy, 'classic')) return legacy;
  }
  return null;
}

export function clearRun(mode, s) {
  remove(s, k('save', mode));
  if (mode === 'classic') remove(s, LEGACY_SAVE_KEY);
}

export function getBestFor(mode, s) {
  const pick = (b) => (b && Number.isFinite(b.score) ? b : null);
  const cur = pick(readJson(s, k('best', mode)));
  const legacy = mode === 'classic' ? pick(readJson(s, LEGACY_BEST_KEY)) : null;
  const best = [cur, legacy].filter(Boolean).sort((a, b) => b.score - a.score)[0];
  return best || { score: 0, words: 0 };
}

export function getStats(mode, s) {
  const st = readJson(s, k('stats', mode));
  const o = st && typeof st === 'object' ? st : {};
  const n = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);
  return { runs: n(o.runs), words: n(o.words), totalScore: n(o.totalScore), bestWords: n(o.bestWords) };
}

/** Records a finished run (best score + statistics); returns true if it's a new best score. */
export function recordRunFor(mode, { score, words }, s) {
  const st = getStats(mode, s);
  writeJson(s, k('stats', mode), { runs: st.runs + 1, words: st.words + words, totalScore: st.totalScore + score, bestWords: Math.max(st.bestWords, words) });
  const best = getBestFor(mode, s);
  if (score <= best.score) return false;
  writeJson(s, k('best', mode), { score, words });
  return true;
}

export const getMeta = (s) => {
  const m = readJson(s, META_KEY);
  return m && typeof m === 'object' ? m : {};
};
export const setMeta = (meta, s) => writeJson(s, META_KEY, { ...getMeta(s), ...meta });

// Original Classic-only API (kept for compatibility).
export const saveGame = (state, s) => saveRun('classic', state, s);
export const loadGame = (s) => loadRun('classic', s);
export const clearGame = (s) => clearRun('classic', s);
export const getBest = (s) => getBestFor('classic', s);
export const recordRun = (run, s) => recordRunFor('classic', run, s);
