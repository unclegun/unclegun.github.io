import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dictionary, wildDictionary } from './helpers.js';
import { GameEngine, scoreFor } from '../js/gameEngine.js';
import { MODES, MODE_ORDER, TOKEN_ECONOMY } from '../js/gameModes.js';
import { CrosswordBoard, CrosswordGenerator, analyzePlacement, publicOption } from '../js/crosswordGenerator.js';
import { H, V, cellsOf, key, validatePlacement } from '../js/placementValidator.js';
import { evaluateGuess } from '../js/wordleEvaluator.js';
import { createRng } from '../js/random.js';
import { scoreWord, SCORING } from '../js/scoring.js';
import { ResourceManager } from '../js/resourceManager.js';
import { ChallengeManager, OBJECTIVES } from '../js/challengeManager.js';
import { validateSave } from '../js/saveValidator.js';
import { saveRun, loadRun, clearRun, getBestFor, recordRunFor, saveGame, loadGame, getStats } from '../js/storage.js';
import { buildShareGrid, buildShareText } from '../js/share.js';
import { getRules } from '../js/modeRules.js';

const memStore = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
const json = (o) => JSON.parse(JSON.stringify(o));

function assertValidBoard(board) {
  const letters = new Map();
  for (const w of board.words) for (const c of cellsOf(w.word, w.x, w.y, w.dir)) {
    const k = key(c.x, c.y);
    assert.ok(!letters.has(k) || letters.get(k) === c.letter, 'letter conflict');
    letters.set(k, c.letter);
  }
  for (const [k] of letters) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy, dir] of [[1, 0, H], [0, 1, V]]) {
      if (letters.has(key(x - dx, y - dy)) || !letters.has(key(x + dx, y + dy))) continue;
      let len = 0;
      while (letters.has(key(x + dx * len, y + dy * len))) len++;
      assert.ok(board.words.some((w) => w.dir === dir && w.x === x && w.y === y && w.word.length === len), 'unintended word at ' + k);
    }
  }
  assert.equal(new Set(board.words.map((w) => w.word)).size, board.words.length, 'duplicate answer');
}

/** Plays n words perfectly, always choosing options in a rotating way. */
function playMode(e, n) {
  for (let i = 0; i < n && e.status === 'playing'; i++) {
    if (e.phase === 'choosing') {
      const o = e.publicOptions;
      assert.ok(e.choose(o[i % o.length].id).ok);
    }
    e.precompute();
    assert.ok(e.submitGuess(e.current.word).solved);
    e.advance();
  }
  if (e.phase === 'choosing' && e.status === 'playing') { /* leave at the choice */ }
}

const D = wildDictionary;

// ---- Classic regression ----
test('Classic scoring is the original formula and has no new mechanics', () => {
  assert.equal(scoreWord('classic', { attempts: 1, baseAttempts: 6 }).total, scoreFor(1));
  for (let a = 1; a <= 6; a++) assert.equal(scoreWord('classic', { attempts: a, baseAttempts: 6 }).total, scoreFor(a));
  const e = new GameEngine({ dictionary: D, seed: 21 });
  assert.equal(e.mode.id, 'classic');
  assert.equal(e.resources, null);
  assert.equal(e.challenges, null);
  assert.equal(e.hint().ok, false);
  assert.equal(e.extraTry().ok, false);
  assert.equal(e.reroll('x').ok, false);
  assert.equal(e.maxAttempts, 6);
  assert.equal(e.wordLength, 5);
  e.submitGuess(e.current.word);
  assert.equal(e.score, scoreFor(1));
  e.advance();
  assert.equal(e.phase, 'guessing'); // placement is automatic, never a choice
  assert.equal(e.options, null);
});

test('Classic generation is identical with the extended dictionary and with the original one', () => {
  const run = (d) => { const e = new GameEngine({ dictionary: d, seed: 31 }); for (let i = 0; i < 15; i++) { e.precompute(); e.submitGuess(e.current.word); e.advance(); } return e.board.words; };
  assert.deepEqual(run(D), run(dictionary));
});

test('Classic saves keep the original v1 shape and legacy keys are migrated', () => {
  const e = new GameEngine({ dictionary, seed: 4 });
  e.submitGuess(e.current.word);
  e.advance();
  const st = json(e.toJSON());
  assert.equal(st.version, 1);
  assert.equal(st.mode, undefined);
  const s = memStore();
  s.setItem('wordchain.save.v1', JSON.stringify(st)); // written by the previous release
  s.setItem('wordchain.best.v1', JSON.stringify({ score: 777, words: 9 }));
  assert.deepEqual(loadRun('classic', s), st);
  assert.equal(getBestFor('classic', s).score, 777);
  assert.equal(loadRun('builder', s), null);
  const r = new GameEngine({ dictionary, state: validateSave(st, dictionary, 'classic') });
  assert.deepEqual(r.toJSON(), e.toJSON());
  saveRun('classic', st, s);
  assert.equal(s.getItem('wordchain.save.v1'), null);
  assert.deepEqual(loadRun('classic', s), st);
  assert.deepEqual(loadGame(s), st);
});

// ---- modes ----
test('five modes are configured; only strategic modes have Tokens', () => {
  assert.deepEqual(MODE_ORDER, ['classic', 'builder', 'architect', 'challenge', 'wildcard']);
  assert.equal(MODE_ORDER[0], 'classic');
  for (const id of MODE_ORDER) {
    const m = MODES[id];
    assert.ok(m.name && m.icon && m.description);
    assert.equal(!!m.features.tokens, id !== 'classic');
  }
  assert.equal(MODES.challenge.features.challenges, true);
  assert.deepEqual(MODES.wildcard.wordLengths, [4, 5, 6, 7]);
  assert.deepEqual(MODES.classic.wordLengths, [5]);
});

test('every mode initializes and plays 25 valid sequential placements (seeded)', () => {
  for (const id of MODE_ORDER) {
    for (const seed of [3, 41]) {
      const e = new GameEngine({ dictionary: D, seed, mode: id });
      playMode(e, 25);
      assert.equal(e.status, 'playing', `${id} seed ${seed}`);
      assert.ok(e.solved >= 25, `${id} seed ${seed}: ${e.solved}`);
      assertValidBoard(e.board);
      const lens = new Set(e.board.words.map((w) => w.word.length));
      if (id === 'wildcard') assert.ok(lens.size >= 3, 'variety of lengths: ' + [...lens]);
      else assert.deepEqual([...lens], [5]);
    }
  }
});

test('seeded games are reproducible per mode', () => {
  for (const id of MODE_ORDER) {
    const run = (seed) => { const e = new GameEngine({ dictionary: D, seed, mode: id }); playMode(e, 12); return e.board.words; };
    assert.deepEqual(run(9), run(9), id);
    assert.notDeepEqual(run(9), run(10), id);
  }
});

// ---- candidates / selection ----
test('options are valid, distinct, classified and never reveal the target', () => {
  const e = new GameEngine({ dictionary: D, seed: 5, mode: 'builder' });
  playMode(e, 8);
  assert.equal(e.phase, 'choosing');
  const pub = e.publicOptions;
  assert.ok(pub.length >= 2 && pub.length <= 3);
  assert.equal(new Set(pub.map((o) => o.id)).size, pub.length);
  for (const [i, o] of pub.entries()) {
    assert.ok(!('word' in o));
    assert.ok(!JSON.stringify(o).includes(e.options[i].word), 'target hidden');
    assert.equal(o.crossings, o.intersections.length);
    assert.equal(o.revealed, o.crossings);
    assert.ok(['expand', 'connect', 'junction'].includes(o.category));
    const full = e.options[i];
    assert.ok(validatePlacement(e.board, full.word, full.x, full.y, full.dir).ok);
    for (const ix of o.intersections) assert.equal(e.board.cells.get(key(ix.x, ix.y)).letter, ix.letter);
  }
  // nearly identical placements are avoided
  const a = pub.map((o) => `${o.dir}${o.x}${o.y}`);
  assert.equal(new Set(a).size, a.length);
});

test('choosing an option starts exactly that target at that position', () => {
  const e = new GameEngine({ dictionary: D, seed: 6, mode: 'architect' });
  playMode(e, 6);
  const target = e.options[1];
  const res = e.choose(target.id);
  assert.ok(res.ok);
  assert.deepEqual(e.current, { word: target.word, x: target.x, y: target.y, dir: target.dir });
  const locked = e.crossingLocked;
  assert.equal(Object.keys(locked).length, target.crossings);
  for (const ix of target.intersections) assert.equal(locked[ix.index], ix.letter);
  assert.equal(e.options, null);
  assert.equal(e.choose(target.id).ok, false); // cannot choose twice
  e.submitGuess(target.word);
  assert.ok(e.board.has(target.word));
  assertValidBoard(e.board);
});

test('placement categories reflect real board structure', () => {
  const board = new CrosswordBoard();
  board.addWord('crane', 0, 0, H);
  board.addWord('cabin', 0, 0, V); // crosses at the C
  const one = analyzePlacement(board, { word: 'nylon', x: 4, y: 0, dir: V });
  assert.equal(one.crossings, 1);
  assert.equal(one.category, 'expand');
  // a word that touches letters only by adjacency is rejected by the validator and never counted
  assert.equal(validatePlacement(board, 'xxxxx', 1, 1, H).ok, false);
  const gen = new CrosswordGenerator({ dictionary: D, rng: createRng(1) });
  const e = new GameEngine({ dictionary: D, seed: 8, mode: 'architect' });
  playMode(e, 15);
  const cats = new Set();
  for (let s = 1; s < 30; s++) {
    const g = new CrosswordGenerator({ dictionary: D, rng: createRng(s) });
    for (const c of g.findOptions(e.board, { count: 3, wordNumber: 16 })) {
      cats.add(c.category);
      const a = analyzePlacement(e.board, c);
      assert.equal(a.crossings, cellsOf(c.word, c.x, c.y, c.dir).filter((p) => e.board.cells.has(key(p.x, p.y))).length);
      if (c.category === 'junction') assert.ok(c.crossings >= 2);
      if (c.category === 'connect') assert.equal(c.crossings, 2);
      if (c.category === 'expand') assert.equal(c.crossings, 1);
    }
  }
  assert.ok(cats.has('expand') && cats.has('connect'), [...cats].join());
  assert.ok(gen);
});

test('fallbacks: one option is offered with Continue, none completes the run', () => {
  const one = createDictionaryFor(['crane', 'rates']);
  const e = new GameEngine({ dictionary: one, seed: 1, mode: 'builder' });
  e.submitGuess(e.current.word);
  const opts = e.advance();
  if (e.status === 'playing') {
    assert.equal(opts.length, 1);
    assert.equal(e.phase, 'choosing');
    assert.ok(e.choose(opts[0].id).ok);
  }
  const none = createDictionaryFor(['crane', 'zzzzz']);
  const f = new GameEngine({ dictionary: none, seed: 1, mode: 'architect' });
  f.submitGuess(f.current.word);
  assert.equal(f.advance(), null);
  assert.equal(f.status, 'complete');
});

function createDictionaryFor(answers) {
  const d = createDictionaryShim(answers);
  return d;
}
import { createDictionary } from '../js/dictionaryService.js';
function createDictionaryShim(answers) { return createDictionary({ valid: [], answers }); }

test('option generation stays bounded on a large board', () => {
  const e = new GameEngine({ dictionary: D, seed: 77 });
  for (let i = 0; i < 40; i++) { e.submitGuess(e.current.word); e.advance(); }
  const gen = new CrosswordGenerator({ dictionary: D, rng: createRng(3) });
  const t = performance.now();
  for (let i = 0; i < 10; i++) gen.findOptions(e.board, { count: 3, wordNumber: 41 });
  assert.ok((performance.now() - t) / 10 < 250);
});

// ---- Wildcard ----
test('variable-length dictionary lookups and crossings work', () => {
  for (const n of [4, 5, 6, 7]) {
    assert.ok(D.hasLength(n));
    assert.ok(D.answersOf(n).every((w) => w.length === n));
    assert.ok(D.isValidGuess(D.answersOf(n)[0]));
  }
  assert.equal(D.isValidGuess('abcdefgh'), false);
  const w4 = D.wordsWith(1, 'a', 4);
  assert.ok(w4.length && w4.every((w) => w.length === 4 && w[1] === 'a'));
  const e = new GameEngine({ dictionary: D, seed: 12, mode: 'wildcard' });
  playMode(e, 20);
  assertValidBoard(e.board);
  let mixed = 0;
  for (const w of e.board.words) for (const o of e.board.words) {
    if (w.dir !== o.dir && w.word.length !== o.word.length && cellsOf(w.word, w.x, w.y, w.dir).some((c) => cellsOf(o.word, o.x, o.y, o.dir).some((d) => d.x === c.x && d.y === c.y))) mixed++;
  }
  assert.ok(mixed > 0, 'words of different lengths cross');
});

test('Wildcard adapts guess length, introduces lengths gradually and keeps 6 attempts', () => {
  const rules = getRules(MODES.wildcard);
  assert.deepEqual(rules.lengthsFor(1), [5]);
  assert.ok(rules.lengthsFor(4).includes(4) && !rules.lengthsFor(4).includes(7));
  assert.ok(rules.lengthsFor(9).includes(7));
  const e = new GameEngine({ dictionary: D, seed: 2, mode: 'wildcard' });
  assert.equal(e.maxAttempts, 6);
  assert.equal(e.wordLength, 5);
  while (e.wordLength === 5 && e.status === 'playing') { e.submitGuess(e.current.word); e.advance(); }
  const len = e.wordLength;
  assert.notEqual(len, 5);
  assert.equal(e.checkGuess('crane'), 'Not enough letters');
  const wrong = D.answersOf(len).find((w) => w !== e.current.word && e.checkGuess(w) === null);
  assert.ok(e.submitGuess(wrong).ok);
  assert.equal(e.guesses[0].result.length, len);
});

test('duplicate letters are evaluated correctly for every length', () => {
  assert.deepEqual(evaluateGuess('allee', 'eagle'), ['present', 'present', 'absent', 'present', 'correct']);
  assert.deepEqual(evaluateGuess('speed', 'abide'), ['absent', 'absent', 'present', 'absent', 'present']);
  assert.deepEqual(evaluateGuess('noon', 'moon'), ['absent', 'correct', 'correct', 'correct']);
  assert.deepEqual(evaluateGuess('geese', 'elder'), ['absent', 'present', 'present', 'absent', 'absent']);
  assert.deepEqual(evaluateGuess('seesaw', 'masses'), ['present', 'present', 'absent', 'correct', 'present', 'absent']);
  assert.deepEqual(evaluateGuess('letters', 'letters'), Array(7).fill('correct'));
});

// ---- tokens ----
test('Tokens cannot be overspent and limits are enforced', () => {
  const r = new ResourceManager({ ...TOKEN_ECONOMY, start: 3 });
  assert.equal(r.check('hint').ok, true);
  assert.ok(r.commit('hint'));
  assert.equal(r.tokens, 1);
  assert.equal(r.check('hint').error, 'Not enough Tokens');
  assert.equal(r.commit('hint'), false);
  assert.equal(r.commit('extraTry'), false);
  assert.equal(r.tokens, 1);
  assert.ok(r.commit('reroll'));
  assert.equal(r.tokens, 0);
  const rich = new ResourceManager({ ...TOKEN_ECONOMY, start: 12 });
  assert.equal(rich.award('x', 5, { perWord: false }), 0, 'balance cap');
  assert.ok(rich.commit('extraTry') && rich.commit('extraTry'));
  assert.equal(rich.check('extraTry').error, 'Limit reached');
});

test('earning rules cannot be farmed', () => {
  const r = new ResourceManager({ ...TOKEN_ECONOMY, start: 0 });
  assert.equal(r.award('w1:efficient', 1), 1);
  assert.equal(r.award('w1:efficient', 1), 0, 'same key twice');
  assert.equal(r.award('w1:cross', 1), 1);
  assert.equal(r.award('w1:other', 1), 0, 'per-word cap');
  r.resetWord();
  assert.equal(r.award('w2:efficient', 1), 1);
  const copy = new ResourceManager(TOKEN_ECONOMY, json(r.toJSON()));
  assert.equal(copy.award('w2:efficient', 1), 0, 'keys survive save/restore');
  assert.ok(ResourceManager.isValidState(json(r.toJSON()), TOKEN_ECONOMY));
  assert.equal(ResourceManager.isValidState({ ...r.toJSON(), tokens: -1 }, TOKEN_ECONOMY), false);
});

test('Hint reveals a locked clue and is charged once', () => {
  const e = new GameEngine({ dictionary: D, seed: 14, mode: 'builder' });
  const before = e.resources.tokens;
  const res = e.hint();
  assert.ok(res.ok);
  assert.equal(e.resources.tokens, before - TOKEN_ECONOMY.costs.hint);
  assert.equal(e.current.word[res.index], res.letter);
  assert.equal(e.locked[res.index], res.letter);
  const other = D.answersOf(5).find((w) => w[res.index] !== res.letter && D.isValidGuess(w));
  assert.equal(e.checkGuess(other), 'Locked letters must be kept');
  assert.equal(e.guesses.length, 0);
  assert.equal(e.hint().ok, false); // not enough tokens for a second hint
  assert.equal(e.resources.tokens, before - TOKEN_ECONOMY.costs.hint);
  // hint is never given on crossing-locked letters and survives save/restore
  const r = new GameEngine({ dictionary: D, state: json(e.toJSON()) });
  assert.deepEqual(r.locked, e.locked);
});

test('Hint never reveals crossing letters or the whole word', () => {
  const e = new GameEngine({ dictionary: D, seed: 15, mode: 'builder' });
  e.resources.tokens = 12;
  playMode(e, 3);
  if (e.phase === 'choosing') e.choose(e.publicOptions[0].id);
  const crossing = Object.keys(e.crossingLocked).map(Number);
  for (let i = 0; i < 5 && e.hint().ok; i++);
  for (const i of crossing) assert.equal(e.hints[i], undefined);
  assert.ok(Object.keys(e.locked).length < e.current.word.length);
  assert.ok(Object.keys(e.hints).length <= TOKEN_ECONOMY.limits.hintPerWord);
});

test('Extra Try adds an attempt up to the cap and costs Tokens only on success', () => {
  const e = new GameEngine({ dictionary: D, seed: 16, mode: 'architect' });
  e.resources.tokens = 12;
  assert.equal(e.attemptsLeft, 6);
  assert.ok(e.extraTry().ok);
  assert.equal(e.attemptsLeft, 7);
  assert.ok(e.extraTry().ok);
  const bal = e.resources.tokens;
  assert.equal(e.extraTry().ok, false); // cap
  assert.equal(e.resources.tokens, bal);
  assert.equal(e.maxAttempts, 6 + TOKEN_ECONOMY.limits.extraTryPerWord);
  const wrongs = D.answersOf(5).filter((w) => w !== e.current.word && e.checkGuess(w) === null).slice(0, 8);
  for (const w of wrongs) e.submitGuess(w);
  assert.equal(e.status, 'lost');
  assert.equal(e.guesses.length, 8);
  // a new word resets the per-word allowance
  const f = new GameEngine({ dictionary: D, seed: 17, mode: 'builder' });
  f.resources.tokens = 12;
  f.extraTry();
  f.submitGuess(f.current.word);
  f.advance();
  f.choose(f.publicOptions[0].id);
  assert.equal(f.extra, 0);
  assert.equal(f.attemptsLeft, 6);
});

test('Reroll swaps a placement for a different valid one and only charges on success', () => {
  const e = new GameEngine({ dictionary: D, seed: 18, mode: 'builder' });
  playMode(e, 6);
  e.resources.tokens = 5;
  const old = e.options.map((o) => ({ id: o.id, word: o.word }));
  const res = e.reroll(old[0].id);
  assert.ok(res.ok);
  assert.equal(e.resources.tokens, 4);
  assert.ok(!old.some((o) => o.id === res.option.id), 'not a duplicate footprint');
  assert.ok(!old.some((o) => o.word === e.options[0].word), 'not a duplicate word');
  assert.ok(validatePlacement(e.board, e.options[0].word, e.options[0].x, e.options[0].y, e.options[0].dir).ok);
  assert.equal(new Set(e.options.map((o) => o.id)).size, e.options.length);
  // no replacement available => no charge
  const tiny = createDictionary({ valid: [], answers: ['crane', 'rates', 'zzzzz'] });
  const t = new GameEngine({ dictionary: tiny, seed: 3, mode: 'builder' });
  t.submitGuess(t.current.word);
  t.advance();
  if (t.phase === 'choosing') {
    const bal = t.resources.tokens;
    const r = t.reroll(t.options[0].id);
    if (!r.ok) assert.equal(t.resources.tokens, bal);
  }
  // limit per round
  e.resources.tokens = 12;
  let ok = 0;
  for (let i = 0; i < 5; i++) if (e.reroll(e.options[0].id).ok) ok++;
  assert.ok(ok <= TOKEN_ECONOMY.limits.rerollPerRound);
});

test('Tokens are earned through play only and never exist in Classic', () => {
  const e = new GameEngine({ dictionary: D, seed: 19, mode: 'builder' });
  const start = e.resources.tokens;
  const res = e.submitGuess(e.current.word);
  assert.ok(res.breakdown.tokens >= 1); // solved in one guess
  assert.ok(e.resources.tokens > start);
  assert.ok(e.resources.earnedThisWord <= TOKEN_ECONOMY.earn.perWordCap);
  const c = new GameEngine({ dictionary: D, seed: 19 });
  assert.equal(c.toJSON().resources, undefined);
});

// ---- scoring ----
test('mode-specific scoring is exact and itemized', () => {
  const base = { attempts: 2, baseAttempts: 6, length: 5, known: 1, density: 0.5 };
  const b = scoreWord('builder', { ...base, analysis: { crossings: 1, category: 'expand', bonuses: {} } });
  assert.equal(b.total, 100 + 40 + 4 * 5 + SCORING.builder.expand);
  const b2 = scoreWord('builder', { ...base, known: 3, analysis: { crossings: 3, category: 'junction', bonuses: {} } });
  assert.equal(b2.total, 100 + 40 + 2 * 5 + 2 * 15 + 40);
  const fewer = scoreWord('builder', { ...base, known: 1, analysis: { crossings: 1, category: 'expand', bonuses: {} } }).total;
  const more = scoreWord('builder', { ...base, known: 2, analysis: { crossings: 2, category: 'expand', bonuses: {} } }).total;
  assert.ok(fewer - more === 5 - 15, 'fewer known letters earn more unknown-letter points (offset by the extra intersection bonus)');
  const a = scoreWord('architect', { ...base, analysis: { crossings: 3, category: 'junction', bonuses: { compact: true }, linear: false } });
  assert.equal(a.total, 50 + 20 + 75 + 60 + 20 + Math.round(0.5 * 30));
  const lin = scoreWord('architect', { ...base, analysis: { crossings: 1, category: 'expand', bonuses: {}, linear: true } });
  assert.ok(lin.items.some((i) => i.points < 0));
  assert.ok(a.total > scoreWord('architect', { ...base, analysis: { crossings: 1, category: 'expand', bonuses: {}, linear: false } }).total + 100, 'structure matters');
  const c = scoreWord('challenge', { attempts: 3, baseAttempts: 6 });
  assert.equal(c.total, 130);
  const w4 = scoreWord('wildcard', { attempts: 1, baseAttempts: 6, length: 4, known: 1 });
  const w7 = scoreWord('wildcard', { attempts: 1, baseAttempts: 6, length: 7, known: 1 });
  assert.equal(w4.total, 80 + 50 + 3 * 5);
  assert.equal(w7.total, 140 + 50 + 6 * 5);
  for (const r of [b, a, c, w4]) assert.equal(r.total, Math.max(0, r.items.reduce((s, i) => s + i.points, 0)));
  const custom = scoreWord('classic', { attempts: 1, baseAttempts: 6 }, { word: 7, attempt: 1 });
  assert.equal(custom.total, 12);
});

test('Architect rewards structure: connected placements outscore linear ones in play', () => {
  const e = new GameEngine({ dictionary: D, seed: 23, mode: 'architect' });
  playMode(e, 12);
  assert.ok(e.history.some((h) => h.crossings >= 2));
  const multi = e.history.filter((h) => h.crossings >= 2).map((h) => h.points);
  const single = e.history.filter((h) => h.crossings === 1).map((h) => h.points);
  if (multi.length && single.length) assert.ok(Math.max(...multi) > Math.max(...single));
  assert.ok(e.lastBreakdown.items.length >= 3);
  assert.equal(e.score, e.history.reduce((s, h) => s + h.points, 0));
});

// ---- challenges ----
test('challenges complete only when their conditions are met', () => {
  const game = { solved: 0, score: 0 };
  const rng = createRng(1);
  const probe = { maxCrossings: 3, hasJunction: true, dirs: { across: true, down: true } };
  const mk = (id) => { const m = new ChallengeManager(); m.current = { id, progress: 0, ...OBJECTIVES[id].build(game) }; return m; };
  const ev = (o = {}) => ({ attempts: 3, crossings: 1, category: 'expand', dir: H, hints: 0, extra: 0, wordScore: 150, ...o });

  const s = mk('streak3');
  assert.equal(s.record(ev(), game).completed, null);
  assert.equal(s.record(ev({ attempts: 6 }), game).completed, null);
  assert.equal(s.current.progress, 0, 'resets after a slow word');
  s.record(ev(), game); s.record(ev(), game);
  assert.equal(s.record(ev(), game).completed?.id, 'streak3');

  const x = mk('two_cross');
  assert.equal(x.record(ev({ crossings: 1 }), game).completed, null);
  assert.equal(x.record(ev({ crossings: 2 }), game).completed?.id, 'two_cross');

  const j = mk('junction');
  assert.equal(j.record(ev({ crossings: 2, category: 'connect' }), game).completed, null);
  assert.equal(j.record(ev({ crossings: 3, category: 'junction' }), game).completed?.id, 'junction');

  const st = mk('steady5');
  for (let i = 0; i < 4; i++) st.record(ev(), game);
  st.record(ev({ hints: 1 }), game);
  assert.equal(st.current.progress, 0);

  const o = mk('both_orient');
  assert.equal(o.record(ev({ dir: H }), game).completed, null);
  assert.equal(o.record(ev({ dir: H }), game).completed, null);
  assert.equal(o.record(ev({ dir: V }), game).completed?.id, 'both_orient');

  const r = mk('reach_words');
  assert.equal(r.record(ev(), { solved: 3, score: 0 }).completed, null);
  assert.equal(r.record(ev(), { solved: 4, score: 0 }).completed?.id, 'reach_words');

  const t = new ChallengeManager();
  t.current = { id: 'target_score', progress: 0, ...OBJECTIVES.target_score.build({ solved: 0, score: 1000 }) };
  assert.equal(t.current.target, 1400);
  assert.equal(t.record(ev({ wordScore: 300 }), game).completed, null); // 1300 < 1400
  assert.equal(t.record(ev({ wordScore: 300 }), game).completed?.id, 'target_score'); // 1600 >= 1400
  assert.ok(rng && probe);
});

test('objectives are only generated when achievable on the current board', () => {
  const rng = createRng(7);
  const none = { maxCrossings: 1, hasJunction: false, dirs: { across: true, down: false } };
  for (let i = 0; i < 40; i++) {
    const m = new ChallengeManager();
    m.generate({ solved: 3, score: 400 }, none, rng);
    assert.ok(!['two_cross', 'junction', 'both_orient'].includes(m.current.id), m.current.id);
  }
  const m = new ChallengeManager();
  assert.equal(m.generate({ solved: 0, score: 0 }, none, createRng(1)) !== null, true);
  const seen = new Set();
  for (let s = 0; s < 80; s++) {
    const g = new ChallengeManager();
    g.generate({ solved: 0, score: 0 }, { maxCrossings: 3, hasJunction: true, dirs: { across: true, down: true } }, createRng(s));
    seen.add(g.current.id);
  }
  assert.equal(seen.size, Object.keys(OBJECTIVES).length);
  assert.equal(new ChallengeManager({ current: { id: 'junction', progress: 0, target: 1, text: 't', reward: { score: 1, tokens: 1 } }, completed: 0 }).isStillAchievable(none), false);
});

test('Challenge mode awards objective rewards and generates the next objective', () => {
  const e = new GameEngine({ dictionary: D, seed: 25, mode: 'challenge' });
  assert.ok(e.challenges.current);
  const seen = [];
  let rewarded = 0;
  for (let i = 0; i < 40 && e.status === 'playing'; i++) {
    if (e.phase === 'choosing') e.choose(e.publicOptions[i % e.publicOptions.length].id);
    const before = e.score;
    const res = e.submitGuess(e.current.word);
    if (res.breakdown.objective) {
      rewarded++;
      assert.equal(e.score - before, res.breakdown.total);
      assert.ok(res.breakdown.items.some((x) => x.label.startsWith('Objective')));
    }
    e.advance();
    if (e.challenges.current) seen.push(e.challenges.current.id);
  }
  assert.ok(rewarded >= 3);
  assert.ok(e.challenges.completed >= rewarded);
  assert.ok(e.challenges.current, 'always a next objective');
  assert.equal(e.summary().objectives, e.challenges.completed);
});

// ---- persistence ----
test('each mode saves, restores and keeps independent progress', () => {
  const s = memStore();
  const engines = {};
  for (const id of MODE_ORDER) {
    const e = new GameEngine({ dictionary: D, seed: 50, mode: id });
    playMode(e, id === 'classic' ? 2 : 4);
    engines[id] = e;
    saveRun(id, { ...e.toJSON(), draft: [] }, s);
  }
  for (const id of MODE_ORDER) {
    const raw = loadRun(id, s);
    const valid = validateSave(raw, D, id);
    assert.ok(valid, id);
    const r = new GameEngine({ dictionary: D, state: valid });
    assert.equal(r.mode.id, id);
    assert.deepEqual(r.toJSON(), engines[id].toJSON());
    assert.equal(r.score, engines[id].score);
  }
  assert.equal(validateSave(loadRun('builder', s), D, 'classic'), null, 'mode mismatch rejected');
  clearRun('builder', s);
  assert.equal(loadRun('builder', s), null);
  assert.ok(loadRun('architect', s), 'other modes untouched');
  assert.ok(loadRun('classic', s));
});

test('seeded random state is preserved across save/restore', () => {
  for (const id of MODE_ORDER) {
    const a = new GameEngine({ dictionary: D, seed: 61, mode: id });
    playMode(a, 5);
    const b = new GameEngine({ dictionary: D, state: json(a.toJSON()) });
    playMode(a, 10);
    playMode(b, 10);
    assert.deepEqual(b.board.words, a.board.words, id);
    assert.equal(b.score, a.score, id);
  }
});

test('interrupted transitions resume safely (solved and choosing phases)', () => {
  for (const id of ['builder', 'challenge', 'wildcard']) {
    const e = new GameEngine({ dictionary: D, seed: 70, mode: id });
    playMode(e, 3);
    if (e.phase === 'choosing') e.choose(e.publicOptions[0].id);
    e.submitGuess(e.current.word); // solved, not advanced
    assert.equal(e.phase, 'solved');
    const saved = json(e.toJSON());
    assert.ok(validateSave(saved, D, id));
    const r = new GameEngine({ dictionary: D, state: saved });
    assert.ok(r.phase === 'choosing' || r.phase === 'guessing');
    assert.equal(r.solved, e.solved);
    assert.equal(r.score, e.score);
    if (r.phase === 'choosing') {
      const again = new GameEngine({ dictionary: D, state: json(r.toJSON()) }); // saved while choosing
      assert.deepEqual(again.publicOptions, r.publicOptions);
      assert.ok(validateSave(json(r.toJSON()), D, id));
      assert.ok(again.choose(again.publicOptions[0].id).ok);
    } else assert.ok(r.submitGuess(r.current.word).solved);
  }
});

test('saves with a hint, an extra try or a mid-word state restore exactly', () => {
  const e = new GameEngine({ dictionary: D, seed: 71, mode: 'architect' });
  e.resources.tokens = 12;
  e.hint(); e.extraTry();
  const wrong = D.answersOf(5).find((w) => e.checkGuess(w) === null && w !== e.current.word);
  e.submitGuess(wrong);
  const saved = json(e.toJSON());
  const r = new GameEngine({ dictionary: D, state: validateSave(saved, D, 'architect') });
  assert.deepEqual(r.toJSON(), e.toJSON());
  assert.equal(r.attemptsLeft, e.attemptsLeft);
  assert.deepEqual(r.locked, e.locked);
});

test('invalid or tampered mode saves fall back gracefully', () => {
  const e = new GameEngine({ dictionary: D, seed: 72, mode: 'challenge' });
  playMode(e, 6);
  const good = json(e.toJSON());
  assert.ok(validateSave(good, D, 'challenge'));
  const bad = [
    { ...good, mode: 'nope' }, { ...good, resources: { ...good.resources, tokens: 999 } }, { ...good, resources: null },
    { ...good, challenges: { current: { id: 'x' }, completed: 0 } }, { ...good, extra: 9 }, { ...good, hints: { 0: 'z', 1: 'z', 2: 'z' } },
    { ...good, phase: 'choosing', options: [] }, { ...good, version: 3 },
  ];
  bad.forEach((b, i) => assert.equal(validateSave(b, D, 'challenge'), null, 'case ' + i));
  // Wildcard saves need the longer word lists
  const w = new GameEngine({ dictionary: D, seed: 3, mode: 'wildcard' });
  assert.equal(validateSave(json(w.toJSON()), dictionary, 'wildcard'), null);
  assert.ok(validateSave(json(w.toJSON()), D, 'wildcard'));
});

test('high scores and stats are stored per mode', () => {
  const s = memStore();
  assert.ok(recordRunFor('builder', { score: 500, words: 4 }, s));
  assert.equal(recordRunFor('builder', { score: 100, words: 1 }, s), false);
  assert.ok(recordRunFor('wildcard', { score: 200, words: 2 }, s));
  assert.equal(getBestFor('builder', s).score, 500);
  assert.equal(getBestFor('wildcard', s).score, 200);
  assert.equal(getBestFor('classic', s).score, 0);
  assert.deepEqual(getStats('builder', s), { runs: 2, words: 5, totalScore: 600, bestWords: 4 });
  saveGame({ version: 1, a: 1 }, s);
  assert.equal(loadRun('builder', s), null);
});

// ---- results / data ----
test('run summary and share representation', () => {
  const e = new GameEngine({ dictionary: D, seed: 80, mode: 'architect' });
  playMode(e, 10);
  const sum = e.summary();
  assert.equal(sum.words, e.solved);
  assert.equal(sum.intersections, e.board.intersectionCount());
  assert.equal(sum.avgGuesses, 1);
  assert.equal(sum.objectives, null);
  const grid = buildShareGrid(e.board.words);
  assert.ok(grid.includes('🟩'));
  assert.equal((grid.match(/🟩/g) || []).length, e.board.cells.size);
  const text = buildShareText({ words: 10, score: 1, best: 1, isBest: true, mode: 'Architect', grid });
  assert.match(text, /^WordChain Architect: 10 words solved/);
});

test('word lists exist for every length, with documented sources and exclusions', () => {
  const read = (f) => readFileSync(new URL('../data/' + f, import.meta.url), 'utf8').split(/\s+/).filter(Boolean);
  const extra = new Set(read('answer-exclusions-extra.txt'));
  for (const n of [4, 6, 7]) {
    const answers = read(`answers-${n}.txt`);
    const valid = new Set(read(`valid-guesses-${n}.txt`));
    assert.ok(answers.length >= 700, `${n}: ${answers.length}`);
    assert.ok(answers.every((w) => w.length === n && /^[a-z]+$/.test(w) && valid.has(w)));
    assert.ok(!answers.some((w) => extra.has(w)));
  }
  assert.match(readFileSync(new URL('../data/README.md', import.meta.url), 'utf8'), /MIT/);
});
