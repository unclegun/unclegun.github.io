import test from 'node:test';
import assert from 'node:assert/strict';
import { dictionary } from './helpers.js';
import { evaluateGuess, letterStatuses } from '../js/wordleEvaluator.js';
import { createDictionary } from '../js/dictionaryService.js';
import { CrosswordBoard, CrosswordGenerator } from '../js/crosswordGenerator.js';
import { validatePlacement, H, V, cellsOf, key } from '../js/placementValidator.js';
import { GameEngine, MAX_ATTEMPTS, scoreFor } from '../js/gameEngine.js';
import { createRng } from '../js/random.js';
import { saveGame, loadGame, getBest, recordRun } from '../js/storage.js';

const memStore = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

test('wordle feedback handles duplicate letters', () => {
  assert.deepEqual(evaluateGuess('crane', 'crane'), Array(5).fill('correct'));
  assert.deepEqual(evaluateGuess('speed', 'abide'), ['absent', 'absent', 'present', 'absent', 'present']);
  assert.deepEqual(evaluateGuess('geese', 'where'), ['absent', 'absent', 'correct', 'absent', 'correct']);
  assert.deepEqual(evaluateGuess('llama', 'hello'), ['present', 'present', 'absent', 'absent', 'absent']);
  assert.equal(letterStatuses([{ word: 'ab', result: ['absent', 'present'] }, { word: 'ab', result: ['correct', 'absent'] }]).a, 'correct');
});

test('dictionary: separate collections, indexed lookup, offensive words excluded', () => {
  assert.ok(dictionary.isValidGuess('crane'));
  assert.ok(!dictionary.isValidGuess('zzzzz'));
  assert.ok(dictionary.answers.length > 1000);
  for (const bad of ['bitch', 'whore', 'penis']) assert.ok(!dictionary.isAnswer(bad));
  assert.ok(dictionary.wordsWith(0, 'c').every((w) => w[0] === 'c'));
});

test('placement validator: crossings, conflicts, adjacency, overlap', () => {
  const b = new CrosswordBoard();
  b.addWord('crane', 0, 0, H);
  assert.ok(validatePlacement(b, 'apple', 2, -1, V).ok === false); // 'a' at index 0 vs row -1 start: no crossing
  assert.deepEqual(validatePlacement(b, 'plane', 3, -4, V).ok, false); // n at idx 3 y=-1 -> wrong cell
  const ok = validatePlacement(b, 'nasty', 3, 0, V);
  assert.ok(ok.ok && ok.crossings === 1);
  assert.equal(validatePlacement(b, 'rusty', 1, 0, V).ok, true);
  assert.equal(validatePlacement(b, 'crank', 0, 0, H).reason, 'overlap');
  assert.equal(validatePlacement(b, 'tower', 1, 0, V).reason, 'conflict');
  b.addWord('nasty', 3, 0, V);
  // parallel adjacent word directly beside nasty would form invalid words
  assert.equal(validatePlacement(b, 'baker', 4, 1, V).reason, 'adjacent');
  assert.equal(validatePlacement(b, 'zzzzz', 10, 10, H).reason, 'no-crossing');
});

function simulate(seed, steps) {
  const rng = createRng(seed);
  const gen = new CrosswordGenerator({ dictionary, rng });
  const board = new CrosswordBoard();
  const f = gen.firstWord();
  board.addWord(f.word, f.x, f.y, f.dir);
  let placed = 1;
  while (placed < steps) {
    const next = gen.pickNext(board);
    if (!next) break;
    const v = validatePlacement(board, next.word, next.x, next.y, next.dir);
    assert.ok(v.ok && v.crossings >= 1);
    assert.ok(!board.has(next.word), 'no duplicate answers');
    board.addWord(next.word, next.x, next.y, next.dir);
    placed++;
  }
  return board;
}

function allLettersConsistent(board) {
  const seen = new Map();
  for (const w of board.words) for (const c of cellsOf(w.word, w.x, w.y, w.dir)) {
    const k = key(c.x, c.y);
    assert.ok(!seen.has(k) || seen.get(k) === c.letter);
    seen.set(k, c.letter);
  }
  // every maximal run of 2+ letters in the grid must be a placed word
  for (const [k] of seen) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy, dir] of [[1, 0, H], [0, 1, V]]) {
      if (seen.has(key(x - dx, y - dy)) || !seen.has(key(x + dx, y + dy))) continue;
      let len = 0;
      while (seen.has(key(x + dx * len, y + dy * len))) len++;
      assert.ok(board.words.some((w) => w.dir === dir && w.x === x && w.y === y && w.word.length === len), 'unintended word at ' + k);
    }
  }
}

test('seeded simulations place 20+ sequential words consistently and reproducibly', () => {
  for (const seed of [1, 2, 3, 42, 777, 2024]) {
    const b = simulate(seed, 25);
    assert.ok(b.words.length >= 20, `seed ${seed} placed ${b.words.length}`);
    allLettersConsistent(b);
    assert.ok(b.words.some((w) => w.dir === H) && b.words.some((w) => w.dir === V));
    assert.equal(new Set(b.words.map((w) => w.word)).size, b.words.length);
  }
  const a = simulate(5, 20), c = simulate(5, 20), d = simulate(6, 20);
  assert.deepEqual(a.words, c.words);
  assert.notDeepEqual(a.words, d.words);
});

test('generator returns null when placements are exhausted', () => {
  const tiny = createDictionary({ valid: [], answers: ['crane', 'zzzzz'] });
  const gen = new CrosswordGenerator({ dictionary: tiny, rng: createRng(1) });
  const b = new CrosswordBoard();
  b.addWord('crane', 0, 0, H);
  assert.equal(gen.pickNext(b), null);
});

function engine(seed = 9) {
  return new GameEngine({ dictionary, seed });
}
const wrongGuess = (e) => ['about', 'think', 'media', 'would', 'plant', 'house'].find((w) => w !== e.current.word && e.checkGuess(w) === null);

test('six-attempt limit ends the run', () => {
  const e = engine();
  const bad = ['about', 'above', 'other', 'which', 'their', 'there'].filter((w) => w !== e.current.word);
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    assert.equal(e.status, 'playing');
    assert.ok(e.submitGuess(bad[i]).ok);
  }
  assert.equal(e.status, 'lost');
  assert.equal(e.submitGuess('about').ok, false);
});

test('invalid guesses are rejected without using an attempt', () => {
  const e = engine();
  assert.equal(e.submitGuess('zzzzz').error, 'Not in word list');
  assert.equal(e.submitGuess('abc').error, 'Not enough letters');
  assert.equal(e.guesses.length, 0);
});

test('solving progresses the game, locks crossing letters and scores', () => {
  const e = engine(11);
  const used = new Set();
  let expected = 0;
  for (let round = 0; round < 25; round++) {
    used.add(e.current.word);
    const locked = e.locked;
    if (round === 0) assert.deepEqual(locked, {});
    else assert.ok(Object.keys(locked).length >= 1 && Object.keys(locked).length <= 4);
    // guess violating a locked letter is rejected
    for (const [i, l] of Object.entries(locked)) {
      const bad = dictionary.answers.find((w) => w[i] !== l && w !== e.current.word);
      assert.equal(e.checkGuess(bad), 'Locked letters must be kept');
    }
    if (round % 2 === 0) { // one miss first
      const miss = dictionary.answers.find((w) => w !== e.current.word && e.checkGuess(w) === null);
      assert.ok(!e.submitGuess(miss).solved);
    }
    const attempts = e.guesses.length + 1;
    expected += scoreFor(attempts);
    e.precompute();
    const r = e.submitGuess(e.current.word);
    assert.ok(r.solved);
    assert.equal(e.phase, 'solved');
    assert.equal(e.submitGuess('about').ok, false); // blocked during transition
    assert.equal(e.score, expected);
    assert.equal(e.solved, round + 1);
    e.advance();
    assert.equal(e.status, 'playing');
    assert.ok(!used.has(e.current.word));
    assert.equal(e.guesses.length, 0);
  }
  assert.ok(scoreFor(1) > scoreFor(6));
});

test('run completes successfully when no placements remain', () => {
  const tiny = createDictionary({ valid: [], answers: ['crane', 'zzzzz'] });
  const e = new GameEngine({ dictionary: tiny, seed: 3 });
  const first = e.current.word;
  e.submitGuess(first);
  assert.equal(e.advance(), null);
  assert.equal(e.status, 'complete');
  assert.equal(e.solved, 1);
});

test('save/resume restores identical state and continues deterministically', () => {
  const e = engine(21);
  for (let i = 0; i < 3; i++) { e.submitGuess(e.current.word); e.advance(); }
  const miss = dictionary.answers.find((w) => w !== e.current.word && e.checkGuess(w) === null);
  e.submitGuess(miss);
  const s = memStore();
  saveGame(e.toJSON(), s);
  const r = new GameEngine({ dictionary, state: loadGame(s) });
  assert.deepEqual(r.toJSON(), e.toJSON());
  assert.deepEqual(r.locked, e.locked);
  e.submitGuess(e.current.word); r.submitGuess(r.current.word);
  assert.deepEqual(e.advance(), r.advance());
});

test('high score storage keeps the best run', () => {
  const s = memStore();
  assert.deepEqual(getBest(s), { score: 0, words: 0 });
  assert.ok(recordRun({ score: 300, words: 3 }, s));
  assert.ok(!recordRun({ score: 200, words: 2 }, s));
  assert.equal(getBest(s).score, 300);
});
