import test from 'node:test';
import assert from 'node:assert/strict';
import { wildDictionary as D } from './helpers.js';
import { validateSave } from '../js/saveValidator.js';
import { AnarchyGame } from '../js/anarchy/anarchyGame.js';
import { EVENTS } from '../js/anarchy/eventRegistry.js';
import * as Chaos from '../js/anarchy/chaosMeter.js';
import { THEMES, themeIndex, themeFor, contrast, applyTheme, clearTheme } from '../js/anarchy/themeDirector.js';
import { AudioDirector, arrangeBar, PROGRESSIONS, AUDIO_KEY } from '../js/anarchy/audioDirector.js';
import { PlaytestMetrics } from '../js/anarchy/playtestMetrics.js';
import { ECONOMY, ArcadeEconomy } from '../js/anarchy/arcadeEconomy.js';

const json = (o) => JSON.parse(JSON.stringify(o));
const fresh = (seed = 1) => { const g = new AnarchyGame({ dictionary: D, seed }); g.beginRound(); return g; };
const memStore = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), data: m }; };

function playWord(g) {
  for (let guard = 0; guard < 6 && g.phase !== 'guessing' && g.phase !== 'over'; guard++) {
    if (g.phase === 'announce') {
      const picks = {};
      for (const c of g.announcement().cards) if (c.choices) picks[c.id] = c.choices[c.choices.length - 1].id;
      g.accept(picks);
    } else if (g.phase === 'event') { if (g.puzzle.type === 'reverse') g.submitReverse(g.engine.current.word); else g.completeEvent({ giveUp: true }); } else if (g.phase === 'transition') g.proceed();
  }
  if (g.phase === 'guessing') { g.submit(g.engine.current.word); if (g.phase === 'transition') g.proceed(); }
}

// ---- shop and inventory ----
test('purchases deduct coins only on success and update inventory', () => {
  const g = fresh(3);
  g.economy.s.coins = 10;
  const r = g.buy('shield');
  assert.ok(r.ok);
  assert.equal(g.coins, 10 - ECONOMY.items.shield.cost);
  assert.equal(g.economy.held('shield'), 1);
  g.economy.s.coins = 1;
  const bad = g.buy('extraGuess');
  assert.equal(bad.ok, false);
  assert.equal(g.coins, 1, 'no charge for a failed purchase');
  assert.match(g.canBuy('extraGuess').error, /Not enough coins/);
});

test('all arcade shop prices and purchase accounting remain consistent', () => {
  for (const [id, item] of Object.entries(ECONOMY.items)) {
    const e = new ArcadeEconomy();
    e.s.coins = 20;
    const before = e.coins;
    assert.deepEqual(e.check(id), { ok: true, cost: item.cost }, `${id} is affordable at its configured price`);
    assert.equal(e.commit(id), true, `${id} can be purchased`);
    assert.equal(e.coins, before - item.cost, `${id} deducts exactly its configured cost`);
    assert.equal(e.s.spent, item.cost, `${id} records its spend once`);
    if (item.kind === 'held') assert.equal(e.held(id), 1, `${id} enters inventory`);
    if (item.kind === 'timed') assert.equal(e.s.doubleCoins, item.rounds, `${id} activates its timed effect`);
    const poor = new ArcadeEconomy();
    poor.s.coins = item.cost - 1;
    assert.equal(poor.commit(id), false, `${id} cannot be purchased without enough coins`);
    assert.equal(poor.coins, item.cost - 1, `${id} does not charge for a failed purchase`);
  }
});

test('shield purchase then arm consumes inventory and persists across save', () => {
  const g = fresh(4);
  g.economy.s.coins = 9;
  g.buy('shield');
  assert.ok(g.useShield().ok);
  assert.equal(g.economy.held('shield'), 0);
  assert.equal(g.economy.s.shieldArmed, true);
  const back = new AnarchyGame({ dictionary: D, saved: validateSave(json(g.toJSON()), D, 'anarchy') });
  assert.equal(back.economy.s.shieldArmed, true);
  assert.equal(back.useShield().ok, false);
});

test('held items respect maxHeld with a reason; use-now items need guessing', () => {
  const g = fresh(5);
  g.economy.s.coins = 50;
  g.buy('stabilizer');
  assert.match(g.canBuy('stabilizer').error, /maximum/);
  g.s.phase = 'announce';
  assert.match(g.canBuy('extraGuess').error, /while guessing/);
  assert.equal(g.canBuy('shield').ok, true, 'held items are buyable between rounds');
});

test('economy item caps work for new instant items without NaN', () => {
  const e = new ArcadeEconomy();
  e.s.coins = 20;
  assert.ok(e.commit('chaosBrake'));
  assert.equal(e.s.used.chaosBrake, 1);
  assert.equal(e.check('chaosBrake').ok, false);
  e.endWord();
  assert.equal(e.check('chaosBrake').ok, true);
});

// ---- chaos meter ----
test('chaos rises predictably and is bounded', () => {
  const c = Chaos.newChaosState();
  const a = Chaos.wordGain({ attempts: 2, crossings: 2 });
  assert.equal(a, Chaos.CHAOS.gains.word + Chaos.CHAOS.gains.efficient + 2 * Chaos.CHAOS.gains.perCrossing);
  for (let i = 0; i < 20; i++) Chaos.onWordSolved(c, { attempts: 1, crossings: 3, hard: true });
  assert.equal(c.value, Chaos.CHAOS.max);
  assert.equal(Chaos.nextKind(c), 'major');
  Chaos.recordPick(c, 'major');
  assert.equal(c.value, 0);
  assert.equal(c.majors, 1);
});

test('catalyst and brake manipulate the meter', () => {
  const c = Chaos.newChaosState();
  const v = c.value;
  Chaos.catalyst(c);
  assert.equal(c.value, v + Chaos.CHAOS.catalystGain);
  assert.equal(c.catalyst, true);
  Chaos.brake(c);
  assert.equal(c.value, v + Chaos.CHAOS.catalystGain - Chaos.CHAOS.brakeDrop < 0 ? 0 : v + Chaos.CHAOS.catalystGain - Chaos.CHAOS.brakeDrop);
});

test('plain streaks are capped and a major arrives within the pacing bounds', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const g = fresh(seed);
    let streak = 0; let maxStreak = 0; let sinceMajor = 0; let firstMajor = null;
    for (let w = 1; w <= 12 && g.phase !== 'over'; w++) {
      playWord(g);
      const tiers = g.entries.filter((e) => e.stage === 'announced' || e.stage === 'active').map((e) => EVENTS[e.id].tier);
      const plain = tiers.length === 0;
      streak = plain ? streak + 1 : 0;
      maxStreak = Math.max(maxStreak, streak);
      if (tiers.some((t) => t === 'major' || t === 'rare')) { sinceMajor = 0; firstMajor ??= w; } else sinceMajor++;
      assert.ok(sinceMajor <= 8, `seed ${seed}: major event within bounds`);
    }
    assert.ok(maxStreak <= 3, `seed ${seed}: no long plain streak (got ${maxStreak})`);
    assert.ok(firstMajor === null || firstMajor <= 6, `seed ${seed}: first major by word 6 (got ${firstMajor})`);
  }
});

test('first modifier can appear in round two (quiet period is one round)', () => {
  let seen = 0;
  for (let seed = 1; seed <= 20; seed++) { const g = fresh(seed); playWord(g); if (g.entries.length || g.phase === 'announce') seen++; }
  assert.ok(seen > 0);
});

test('chaos state survives save/resume and old saves migrate', () => {
  const g = fresh(7);
  playWord(g);
  const saved = json(g.toJSON());
  const back = new AnarchyGame({ dictionary: D, saved: validateSave(saved, D, 'anarchy') });
  assert.deepEqual(back.chaos, g.chaos);
  assert.equal(back.theme.id, g.theme.id);
  const old = json(g.toJSON());
  delete old.anarchy.chaos; delete old.anarchy.themeSeed;
  const migrated = new AnarchyGame({ dictionary: D, saved: validateSave(old, D, 'anarchy') });
  assert.equal(migrated.chaos.value, Chaos.CHAOS.startValue);
  assert.ok(THEMES.includes(migrated.theme));
});

test('chaos catalyst/brake purchases change the meter and are limited per word', () => {
  const g = fresh(8);
  g.economy.s.coins = 20;
  const before = g.chaos.value;
  assert.ok(g.buy('chaosCatalyst').ok);
  assert.ok(g.chaos.value > before);
  assert.equal(g.canBuy('chaosCatalyst').ok, false);
  assert.ok(g.buy('chaosBrake').ok);
  assert.ok(g.chaos.value < before + Chaos.CHAOS.catalystGain);
});

// ---- themes ----
test('theme changes after every solved word, never repeats back-to-back, and is deterministic', () => {
  for (const seed of [1, 2, 99, 12345, 4000000000]) {
    const seq = Array.from({ length: 40 }, (_, i) => themeIndex(seed, i));
    for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1]);
    assert.equal(new Set(seq.slice(0, THEMES.length)).size, THEMES.length, 'full cycle before repeating');
    assert.deepEqual(seq, Array.from({ length: 40 }, (_, i) => themeIndex(seed, i)));
  }
  const g = fresh(11);
  const t0 = g.theme.id;
  playWord(g);
  assert.notEqual(g.theme.id, t0);
});

test('palettes have accessible text contrast and applyTheme leaves Wordle colours alone', () => {
  for (const t of THEMES) {
    assert.ok(contrast(t.vars.fg, t.vars.bg) >= 7, `${t.id} fg/bg`);
    assert.ok(contrast(t.vars.fg, t.vars.panel) >= 7, `${t.id} fg/panel`);
    assert.ok(contrast(t.vars.muted, t.vars.bg) >= 4.5, `${t.id} muted/bg`);
    assert.ok(contrast(t.vars.accent, t.vars.bg) >= 3, `${t.id} accent/bg`);
  }
  const style = new Map();
  const root = { style: { setProperty: (k, v) => style.set(k, v), removeProperty: (k) => style.delete(k) }, dataset: {} };
  applyTheme(root, THEMES[0]);
  assert.ok(!([...style.keys()].some((k) => /correct|present|absent/.test(k))));
  assert.equal(root.dataset.anTheme, 'slate');
  clearTheme(root);
  assert.equal(style.size, 0);
  assert.equal(themeFor(1, 0), THEMES[themeIndex(1, 0)]);
});

// ---- audio ----
function fakeCtx() {
  const ctx = { created: 0, oscs: 0, closed: false, suspended: false, currentTime: 0, sampleRate: 8000, destination: {} };
  const node = () => ({ connect() {}, disconnect() {}, frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, start() {}, stop() {} });
  ctx.createOscillator = () => { ctx.oscs++; return node(); };
  ctx.createGain = node; ctx.createBiquadFilter = node; ctx.createBufferSource = node;
  ctx.createBuffer = (_c, len) => ({ getChannelData: () => new Float32Array(len) });
  ctx.resume = async () => { ctx.suspended = false; };
  ctx.suspend = async () => { ctx.suspended = true; };
  ctx.close = () => { ctx.closed = true; };
  return ctx;
}
function harness() {
  const ctxs = []; const timers = new Map(); let id = 0;
  const storage = memStore();
  const audio = new AudioDirector({ ctxFactory: () => { const c = fakeCtx(); ctxs.push(c); return c; }, storage, timers: { set: (f) => { timers.set(++id, f); return id; }, clear: (i) => timers.delete(i) } });
  return { audio, ctxs, timers, storage };
}

test('audio is off by default and nothing starts without enable()', () => {
  const h = harness();
  assert.equal(h.audio.prefs.music, false);
  assert.equal(h.ctxs.length, 0);
  assert.equal(h.audio.playing, false);
});

test('enable creates exactly one scheduler; repeated enable does not duplicate', async () => {
  const h = harness();
  await h.audio.enable(); await h.audio.enable(); await h.audio.enable();
  assert.equal(h.timers.size, 1);
  assert.equal(h.audio.schedulersCreated, 1);
  assert.equal(h.ctxs.length, 1);
});

test('scheduler produces notes, applies variation at bar boundaries, and stop() cleans up', async () => {
  const h = harness();
  await h.audio.enable();
  const tick = [...h.timers.values()][0];
  h.audio.bump(4);
  for (let i = 0; i < 40; i++) { h.ctxs[0].currentTime += 0.08; tick(); }
  assert.ok(h.ctxs[0].oscs > 20);
  assert.equal(h.audio.variation, 4);
  h.audio.stop();
  assert.equal(h.timers.size, 0);
  assert.equal(h.ctxs[0].closed, true);
  assert.equal(h.audio.playing, false);
});

test('music toggle, volume and sfx persist independently of the run', async () => {
  const h = harness();
  await h.audio.setMusic(true);
  h.audio.setVolume(0.2); h.audio.setSfx(false);
  assert.deepEqual(JSON.parse(h.storage.data.get(AUDIO_KEY)), { music: true, volume: 0.2, sfx: false });
  await h.audio.setMusic(false);
  assert.equal(h.timers.size, 0);
  const again = new AudioDirector({ ctxFactory: () => fakeCtx(), storage: h.storage });
  assert.equal(again.prefs.volume, 0.2);
  assert.equal(again.playing, false, 'saved preference never auto-starts playback');
});

test('hidden page suspends and visible resumes; missing Web Audio never throws', async () => {
  const h = harness();
  await h.audio.enable();
  h.audio.hidden(true); assert.equal(h.ctxs[0].suspended, true);
  h.audio.hidden(false); assert.equal(h.ctxs[0].suspended, false);
  const none = new AudioDirector({ ctxFactory: () => null, storage: memStore() });
  assert.equal(await none.enable(), false);
  none.accent('jackpot');
});

test('every progression bar stays within compatible harmony and arrangement grows with variation', () => {
  for (let v = 0; v < 9; v++) for (let bar = 0; bar < 8; bar++) {
    const b = arrangeBar(bar, v);
    assert.equal(b.chord.length, 4);
    assert.ok(PROGRESSIONS.some((p) => p.some(([r, q]) => r === b.root && q === b.quality)));
  }
  assert.equal(arrangeBar(0, 0).drums, false);
  assert.equal(arrangeBar(0, 1).drums, true);
  assert.equal(arrangeBar(0, 2).melody, true);
});

// ---- metrics ----
test('playtest metrics are local, aggregate, and export as JSON', () => {
  let t = 1000;
  const m = new PlaytestMetrics(memStore(), () => (t += 1000));
  m.startRun();
  m.word({ attempts: 3, coins: 2 }); m.word({ attempts: 5, coins: 1 });
  m.event('jackpot', true); m.event('wordquake', true); m.event('blackout');
  m.purchase('shield', 3); m.shopOpened(); m.failed(); m.reroll();
  m.puzzle({ ms: 500, completed: false, id: 'wordquake' });
  m.endRun();
  const out = JSON.parse(m.exportJSON());
  assert.equal(out.summary.avgGuessesPerWord, 4);
  assert.equal(out.runs[0].coinsSpent, 3);
  assert.equal(out.runs[0].minigames.abandoned, 1);
  assert.ok(out.summary.avgMsBetweenMajorEvents > 0);
  assert.equal(new PlaytestMetrics(m.storage).history.length, 1, 'persisted locally');
});
