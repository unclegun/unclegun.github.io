const SAVE_KEY = 'wordchain.save.v1';
const BEST_KEY = 'wordchain.best.v1';

function store(s) {
  if (s) return s;
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function saveGame(state, s) {
  try { store(s)?.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* ignore quota/private mode */ }
}

export function loadGame(s) {
  try {
    const raw = store(s)?.getItem(SAVE_KEY);
    const data = raw && JSON.parse(raw);
    return data && data.version === 1 ? data : null;
  } catch { return null; }
}

export function clearGame(s) {
  try { store(s)?.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export function getBest(s) {
  try {
    const b = JSON.parse(store(s)?.getItem(BEST_KEY) || 'null');
    return b && Number.isFinite(b.score) ? b : { score: 0, words: 0 };
  } catch { return { score: 0, words: 0 }; }
}

/** Records a finished run; returns true if it's a new best score. */
export function recordRun({ score, words }, s) {
  const best = getBest(s);
  if (score <= best.score) return false;
  try { store(s)?.setItem(BEST_KEY, JSON.stringify({ score, words })); } catch { /* ignore */ }
  return true;
}
