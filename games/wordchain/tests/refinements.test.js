import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dictionary } from './helpers.js';
import { createDictionary } from '../js/dictionaryService.js';
import { CrosswordBoard, CrosswordGenerator } from '../js/crosswordGenerator.js';
import { H, V, cellsOf, key, validatePlacement } from '../js/placementValidator.js';
import { GameEngine } from '../js/gameEngine.js';
import { createRng } from '../js/random.js';
import { crossingPreference } from '../js/difficulty.js';
import { validateSave } from '../js/saveValidator.js';
import { buildCrosswordSvg, buildShareText, shareResult } from '../js/share.js';
import { GuessBuffer } from '../js/input.js';

const play = (e, n) => {
  for (let i = 0; i < n && e.status === 'playing'; i++) {
    e.precompute();
    e.submitGuess(e.current.word);
    e.advance();
  }
};

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

test('reload while in the solved transition resumes at the next word', () => {
  const e = new GameEngine({ dictionary, seed: 11 });
  play(e, 2);
  e.submitGuess(e.current.word); // solved, not yet advanced
  assert.equal(e.phase, 'solved');
  const saved = JSON.parse(JSON.stringify(e.toJSON()));
  assert.ok(validateSave(saved, dictionary));
  const r = new GameEngine({ dictionary, state: saved });
  assert.equal(r.phase, 'guessing');
  assert.equal(r.status, 'playing');
  assert.equal(r.solved, 3);
  assert.equal(r.score, e.score);
  assert.deepEqual(r.guesses, []);
  assert.equal(r.board.words.length, 3);
  assert.ok(!r.board.has(r.current.word));
  assert.ok(validatePlacement(r.board, r.current.word, r.current.x, r.current.y, r.current.dir).ok);
  assert.equal(r.submitGuess(r.current.word).solved, true); // not stuck
});

test('reload mid-guessing preserves guesses, board, score and draft', () => {
  const e = new GameEngine({ dictionary, seed: 4 });
  play(e, 3);
  const miss = dictionary.answers.find((w) => w !== e.current.word && e.checkGuess(w) === null);
  e.submitGuess(miss);
  const saved = JSON.parse(JSON.stringify({ ...e.toJSON(), draft: [...'abcde'].map((l, i) => (i in e.locked ? e.locked[i] : l)) }));
  const r = new GameEngine({ dictionary, state: validateSave(saved, dictionary) });
  assert.deepEqual(r.toJSON(), e.toJSON());
  const b = new GuessBuffer();
  b.reset(r.locked);
  b.restoreDraft(saved.draft);
  assert.equal(b.letters.join(''), saved.draft.join(''));
  b.reset(r.locked);
  b.restoreDraft(['1', 'x', '', '', '']); // malformed draft ignored
  assert.ok(b.letters.every((l, i) => l === (r.locked[i] || '')));
});

test('malformed or outdated saves are rejected', () => {
  const e = new GameEngine({ dictionary, seed: 8 });
  play(e, 3);
  const good = JSON.parse(JSON.stringify(e.toJSON()));
  assert.ok(validateSave(good, dictionary));
  const bad = [
    null, 'x', {}, { ...good, version: 0 }, { ...good, solved: 99 }, { ...good, status: 'bogus' },
    { ...good, words: [{ word: 'ab', x: 0, y: 0, dir: H }] }, { ...good, guesses: 'no' },
    { ...good, current: { word: good.words[0].word, x: 0, y: 0, dir: H } },
    { ...good, words: [good.words[0], good.words[0], good.words[0]] },
    { ...good, rng: 'a' },
  ];
  for (const b of bad) assert.equal(validateSave(b, dictionary), null);
});

test('submissions are ignored once solved (no duplicate scoring)', () => {
  const e = new GameEngine({ dictionary, seed: 3 });
  const word = e.current.word;
  assert.ok(e.submitGuess(word).ok);
  const score = e.score;
  assert.equal(e.submitGuess(word).ok, false);
  assert.equal(e.score, score);
  assert.equal(e.solved, 1);
  const n = e.advance();
  assert.equal(e.advance(), null); // second advance is a no-op
  assert.equal(e.current, n);
});

test('long simulations: 30 words across seeds stay valid and diverse', () => {
  for (const seed of [1, 7, 99, 1234, 5150]) {
    const e = new GameEngine({ dictionary, seed });
    play(e, 30);
    assert.ok(e.board.words.length >= 25, `seed ${seed}: ${e.board.words.length}`);
    assertValidBoard(e.board);
    assert.ok(e.board.words.filter((w) => w.dir === H).length >= 6);
    assert.ok(e.board.words.filter((w) => w.dir === V).length >= 6);
    const b = e.board.bounds();
    assert.ok(b.maxX - b.minX > 8 && b.maxY - b.minY > 8, 'board spreads in both axes');
    // no single anchor word should hog all crossings (branch diversity)
    const cross = new Map();
    for (const w of e.board.words) for (const o of e.board.words) {
      if (o !== w && o.dir !== w.dir && cellsOf(w.word, w.x, w.y, w.dir).some((c) => cellsOf(o.word, o.x, o.y, o.dir).some((d) => d.x === c.x && d.y === c.y))) cross.set(w.word, (cross.get(w.word) || 0) + 1);
    }
    assert.ok(Math.max(...cross.values()) <= 8, 'one word has too many crossings');
  }
});

test('seeded generation is reproducible', () => {
  const run = (seed) => { const e = new GameEngine({ dictionary, seed }); play(e, 15); return e.board.words; };
  assert.deepEqual(run(31), run(31));
  assert.notDeepEqual(run(31), run(32));
});

test('candidates come from multiple anchors and board regions', () => {
  const e = new GameEngine({ dictionary, seed: 12 });
  play(e, 12);
  const gen = new CrosswordGenerator({ dictionary, rng: createRng(5) });
  const c = gen.findCandidates(e.board, 6, { wordNumber: 13 });
  assert.ok(c.length >= 4);
  assert.ok(new Set(c.map((x) => x.anchor)).size >= 3, 'multiple anchors');
  assert.ok(new Set(c.map((x) => Math.floor(x.x / 5) + ',' + Math.floor(x.y / 5))).size >= 2, 'multiple regions');
  for (const x of c) assert.ok(validatePlacement(e.board, x.word, x.x, x.y, x.dir).ok);
});

test('crossing preferences follow difficulty progression and weights are configurable', () => {
  assert.equal(crossingPreference(1), null);
  assert.deepEqual(crossingPreference(3), { min: 1, max: 1 });
  assert.deepEqual(crossingPreference(10), { min: 1, max: 2 });
  assert.deepEqual(crossingPreference(20), { min: 1, max: 3 });
  const e = new GameEngine({ dictionary, seed: 2 });
  play(e, 4);
  const early = new CrosswordGenerator({ dictionary, rng: createRng(1) });
  const picks = early.findCandidates(e.board, 4, { wordNumber: 3 });
  assert.ok(picks.filter((p) => p.crossings === 1).length >= picks.length / 2, 'early words prefer one crossing');
  const noJitter = new CrosswordGenerator({ dictionary, rng: createRng(1), weights: { placement: 0 } });
  assert.equal(noJitter.weights.placement, 0);
  assert.ok(noJitter.weights.crossing > 0);
});

test('placement stays bounded and responsive on a large board', () => {
  const e = new GameEngine({ dictionary, seed: 77 });
  play(e, 40);
  const gen = new CrosswordGenerator({ dictionary, rng: createRng(3) });
  const t = performance.now();
  for (let i = 0; i < 10; i++) gen.findCandidates(e.board, 4, { wordNumber: 41 });
  assert.ok((performance.now() - t) / 10 < 150, 'findCandidates should be fast');
});

test('exhausted placements complete the run gracefully', () => {
  const tiny = createDictionary({ valid: [], answers: ['crane', 'zzzzz'] });
  const e = new GameEngine({ dictionary: tiny, seed: 1 });
  e.submitGuess(e.current.word);
  assert.equal(e.advance(), null);
  assert.equal(e.status, 'complete');
  assert.equal(e.advance(), null);
});

test('answer list excludes blocked words and stays within valid guesses', () => {
  const read = (f) => readFileSync(new URL('../data/' + f, import.meta.url), 'utf8').split(/\s+/).filter(Boolean);
  const blocked = new Set(read('answer-exclusions.txt'));
  const answers = read('answers.txt');
  assert.ok(blocked.size > 50);
  assert.ok(!answers.some((w) => blocked.has(w)));
  assert.ok(answers.every((w) => dictionary.isValidGuess(w)));
  assert.ok(dictionary.answers.length < 0.2 * read('valid-guesses.txt').length, 'guess list broader than answers');
});

test('share: SVG, text and fallbacks', async () => {
  const e = new GameEngine({ dictionary, seed: 6 });
  play(e, 5);
  const svg = buildCrosswordSvg(e.board.words);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.equal((svg.match(/<rect x=/g) || []).length, new Set(e.board.words.flatMap((w) => cellsOf(w.word, w.x, w.y, w.dir).map((c) => key(c.x, c.y)))).size);
  assert.match(buildShareText({ words: 5, score: 520, best: 600, isBest: false }), /5 words solved, score 520\nBest score: 600/);
  assert.match(buildShareText({ words: 1, score: 100, best: 100, isBest: true }), /1 word solved.*\nNew best/);
  const calls = [];
  assert.equal(await shareResult({ svg, text: 't', nav: { share: async (d) => calls.push(d) } }), 'shared');
  assert.equal(calls[0].text, 't');
  assert.equal(await shareResult({ svg, text: 't', nav: { share: async () => { throw Object.assign(new Error(), { name: 'AbortError' }); } } }), 'cancelled');
  let copied;
  assert.equal(await shareResult({ svg, text: 'hi', nav: { clipboard: { writeText: async (t) => { copied = t; } } } }), 'copied');
  assert.equal(copied, 'hi');
});
