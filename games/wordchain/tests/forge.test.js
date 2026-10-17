import test from 'node:test';
import assert from 'node:assert/strict';
import { wildDictionary as D } from './helpers.js';
import { createRng } from '../js/random.js';
import { LetterForge, findAnagrams, findSubstitutions } from '../js/anarchy/puzzles/forge.js';
import { puzzleFromJSON } from '../js/anarchy/puzzles/index.js';
import { ConsequenceManager, MAX_ACTIVE, isValidConsequenceState } from '../js/anarchy/consequences.js';
import { AnarchyGame } from '../js/anarchy/anarchyGame.js';
import { validateSave } from '../js/saveValidator.js';

const json = (o) => JSON.parse(JSON.stringify(o));
const words = [...D.answersOf(5).slice(0, 400), ...D.answersOf(4).slice(0, 100), ...D.answersOf(6).slice(0, 100)];

function solve(p) {
  if (p.hasBlank) assert.ok(p.fillMissing());
  const t = p.solutions[0];
  if (p.variant === 'swap') {
    const idx = [...p.word].findIndex((c, i) => c !== t[i]);
    assert.ok(p.exchange(idx, p.spares.indexOf(t[idx])));
  } else for (let i = 0; i < t.length; i++) { const j = p.slots.indexOf(t[i], i); if (j !== i) p.swap(i, j); }
}

test('forge never targets the solved word and is always solvable with a valid distinct word', () => {
  const seen = { anagram: 0, swap: 0, missing: 0 };
  let nulls = 0;
  for (const [n, w] of words.entries()) {
    const p = LetterForge.create({ dictionary: D, word: w, rng: createRng(n + 1), allowMissing: true, round: 8 });
    if (!p) { nulls++; continue; }
    seen[p.variant]++;
    assert.ok(!p.solutions.includes(w));
    assert.ok(p.solutions.every((s) => D.isAnswer(s) && s !== w));
    assert.equal(p.isSolved(D), false, 'unsolved at start');
    assert.ok(p.variant !== 'anarchy' && (p.variant !== 'anagram' || !D.isValidGuess(p.arrangement)));
    solve(p);
    assert.ok(p.isSolved(D), `${p.variant} ${w} -> ${p.arrangement}`);
    assert.notEqual(p.arrangement, w);
    assert.ok(p.rewardKind(D));
  }
  assert.ok(seen.anagram > 0 && seen.swap > 0 && seen.missing > 0, JSON.stringify(seen));
  assert.ok(nulls < words.length, 'some words have fair variants');
});

test('forge generation is deterministic and bounded', () => {
  const a = LetterForge.create({ dictionary: D, word: 'stare', rng: createRng(5) });
  const b = LetterForge.create({ dictionary: D, word: 'stare', rng: createRng(5) });
  assert.deepEqual(a.toJSON(), b.toJSON());
  assert.ok(findAnagrams(D, 'stare').length >= 1);
  assert.ok(findSubstitutions(D, 'stare').every((s) => D.isAnswer(s.word) && s.word !== 'stare'));
  const t = performance.now();
  for (let i = 0; i < 200; i++) LetterForge.create({ dictionary: D, word: words[i], rng: createRng(i) });
  assert.ok(performance.now() - t < 2000);
});

test('forge: no fair variant returns null instead of a trivial reconstruction', () => {
  const tiny = { answersOf: () => ['aaaaa'], isAnswer: (w) => w === 'aaaaa', isValidGuess: (w) => w === 'aaaaa' };
  assert.equal(LetterForge.create({ dictionary: tiny, word: 'aaaaa', rng: createRng(1) }), null);
});

test('forge: the original word is not accepted; other outcomes pay different rewards', () => {
  const p = LetterForge.create({ dictionary: D, word: 'stare', rng: createRng(2) });
  assert.equal(p.isSolved(D), false);
  if (p.variant === 'swap') { p.slots = [...'stare']; assert.equal(p.isSolved(D), false); }
  const kinds = new Set();
  for (const s of p.solutions) { p.slots = [...s]; p.spares = []; kinds.add(p.rewardKind(D)); }
  assert.ok(kinds.size >= Math.min(p.solutions.length, 2) || p.solutions.length === 1);
});

test('forge serializes, rejects malformed data and cannot alter the crossword', () => {
  const p = LetterForge.create({ dictionary: D, word: 'stare', rng: createRng(9) });
  const r = puzzleFromJSON(json(p));
  assert.deepEqual(r.toJSON(), p.toJSON());
  assert.equal(puzzleFromJSON({ ...json(p), slots: ['1'] }), null);
  assert.equal(puzzleFromJSON({ ...json(p), variant: 'x' }), null);
  assert.equal(puzzleFromJSON({ ...json(p), solutions: [] }), null);
});

test('consequences: caps, merging, expiry, no farming and validation', () => {
  const m = new ConsequenceManager();
  assert.ok(m.add({ id: 'a', source: 'x', type: 'startHint', round: 1 }));
  assert.equal(m.add({ id: 'a', source: 'x', type: 'freeGuess', round: 1 }), null, 'same id never added twice');
  m.add({ id: 'b', source: 'x', type: 'freeGuess', round: 1 });
  m.add({ id: 'c', source: 'x', type: 'shield', round: 1 });
  assert.equal(m.add({ id: 'd', source: 'x', type: 'solveBonus', round: 1 }), null, 'weakest never displaces stronger');
  assert.equal(m.active.length, MAX_ACTIVE);
  m.add({ id: 'e', source: 'x', type: 'startHint', round: 1 });
  assert.equal(m.active.find((e) => e.type === 'startHint').magnitude, 2, 'merged up to cap');
  assert.ok(isValidConsequenceState(json(m)));
  assert.equal(isValidConsequenceState({ list: [{ ...m.active[0], type: 'nope' }], seen: [] }), false);
  assert.equal(m.expire(2).length, 0);
  assert.equal(m.expire(10).length, 3);
});

function stepOnce(g) {
  if (g.phase === 'announce') {
    const picks = {};
    for (const c of g.announcement().cards) if (c.choices) picks[c.id] = c.choices[c.choices.length - 1].id;
    g.accept(picks);
  } else if (g.phase === 'event') { if (g.puzzle.type === 'reverse') g.submitReverse(g.engine.current.word); else g.completeEvent({ giveUp: true }); }
  else if (g.phase === 'guessing') g.submit(g.engine.current.word);
  else if (g.phase === 'transition') g.proceed();
}

function forceForge(seed) {
  const g = new AnarchyGame({ dictionary: D, seed });
  g.beginRound();
  for (let guard = 0; (g.engine.solved < 4 || g.phase !== 'guessing') && guard < 60 && g.phase !== 'over'; guard++) stepOnce(g);
  g.force = 'letter_forge';
  for (let guard = 0; g.phase !== 'event' && g.phase !== 'over' && guard < 12; guard++) { if (g.phase === 'announce' && g.announcement().cards.some((c) => c.id === 'letter_forge')) { g.accept(); break; } stepOnce(g); }
  return g;
}

test('forge reward becomes a carried effect that is applied to the next round exactly once', () => {
  let tested = 0;
  for (const seed of [11, 12, 13, 14, 15, 16]) {
    const g = forceForge(seed);
    if (g.phase !== 'event' || g.puzzle.type !== 'forge') continue;
    tested++;
    const words = JSON.stringify(g.engine.board.words);
    solve(g.puzzle);
    const saved = validateSave(json(g.toJSON()), D, 'anarchy');
    assert.ok(saved, 'save mid-event validates');
    const r = g.completeEvent();
    assert.ok(r.ok);
    assert.equal(JSON.stringify(g.engine.board.words), words, 'crossword untouched');
    const fx = r.reward.effect;
    assert.ok(fx, 'reward produces an effect label');
    assert.equal(g.completeEvent().ok, false);
    // effects with a round-start trigger are applied immediately by the new round; others remain visible
    const applied = g.s.note?.startsWith('Applied') || g.effects.length > 0;
    assert.ok(applied, 'the effect is either applied or visibly pending');
    const again = new AnarchyGame({ dictionary: D, saved: validateSave(json(g.toJSON()), D, 'anarchy') });
    assert.deepEqual(again.effects, g.effects, 'effects survive save/restore');
  }
  assert.ok(tested >= 1);
});

test('solveBonus is consumed by the next solved word', () => {
  const g = new AnarchyGame({ dictionary: D, seed: 3 });
  g.beginRound();
  g.consequences.add({ id: 't1', source: 'letter_forge', type: 'solveBonus', magnitude: 3, round: 1 });
  const before = g.coins;
  const res = g.submit(g.engine.current.word);
  assert.ok(g.coins >= before + 3);
  assert.ok(res.breakdown.items.some((i) => /bonus/i.test(i.label)));
  assert.equal(g.consequences.has('solveBonus'), false);
});

test('older saves without consequences still load', () => {
  const g = new AnarchyGame({ dictionary: D, seed: 4 });
  g.beginRound();
  const save = json(g.toJSON());
  delete save.anarchy.consequences;
  const ok = validateSave(save, D, 'anarchy');
  assert.ok(ok);
  assert.deepEqual(new AnarchyGame({ dictionary: D, saved: ok }).effects, []);
});
