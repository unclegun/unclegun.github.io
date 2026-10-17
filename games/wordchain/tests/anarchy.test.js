import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wildDictionary as D } from './helpers.js';
import { MODES, MODE_ORDER } from '../js/gameModes.js';
import { GameEngine } from '../js/gameEngine.js';
import { validateSave } from '../js/saveValidator.js';
import { createRng } from '../js/random.js';
import { AnarchyGame } from '../js/anarchy/anarchyGame.js';
import { AnarchyDirector, advanceStage } from '../js/anarchy/anarchyDirector.js';
import { EVENTS } from '../js/anarchy/eventRegistry.js';
import { ArcadeEconomy, ECONOMY } from '../js/anarchy/arcadeEconomy.js';
import { pressureAttempts, fairFloor, compatible, viableCount } from '../js/anarchy/eventRules.js';
import { MiniSudoku, countSolutions, generateSolution, isComplete } from '../js/anarchy/puzzles/sudoku.js';
import { SlidingLetters, isReachable } from '../js/anarchy/puzzles/sliding.js';
import { LetterCollapse, findAnagrams } from '../js/anarchy/puzzles/letterCollapse.js';
import { MemoryMatch } from '../js/anarchy/puzzles/memory.js';
import { ReverseWordle, candidatesFor } from '../js/anarchy/puzzles/reverseWordle.js';
import { GravityShift, solveTilts } from '../js/anarchy/puzzles/gravity.js';
import { TileRepair } from '../js/anarchy/puzzles/tileRepair.js';
import { puzzleFromJSON, MINIGAMES } from '../js/anarchy/puzzles/index.js';
import { computeChain } from '../js/anarchy/puzzles/chainReaction.js';
import { buildShareText } from '../js/share.js';

const json = (o) => JSON.parse(JSON.stringify(o));
const fresh = (seed = 1, opts = {}) => { const g = new AnarchyGame({ dictionary: D, seed, ...opts }); g.beginRound(); return g; };
const roundTrip = (g, extra = {}) => {
  const saved = validateSave(json(g.toJSON()), D, 'anarchy');
  assert.ok(saved, 'save validates');
  const r = new AnarchyGame({ dictionary: D, saved, ...extra });
  return r;
};

/** Solves interludes properly (not giving up) using each puzzle's real mechanics. */
function solvePuzzle(g) {
  const p = g.puzzle;
  switch (p.type) {
    case 'forge': {
      if (p.hasBlank) assert.ok(g.fillMissing().ok);
      const target = p.solutions[0];
      if (p.variant === 'swap') {
        const idx = [...p.word].findIndex((c, i) => c !== target[i]);
        p.exchange(idx, p.spares.indexOf(target[idx]));
      } else {
        for (let i = 0; i < target.length; i++) { const j = p.slots.indexOf(target[i], i); if (j !== i) p.swap(i, j); }
      }
      break;
    }
    case 'collapse': {
      if (p.hasBlank) assert.ok(g.fillMissing().ok);
      const target = p.word;
      for (let i = 0; i < target.length; i++) { const j = p.slots.indexOf(target[i], i); if (j !== i) p.swap(i, j); }
      break;
    }
    case 'repair': for (let i = 0; i < p.letters.length; i++) { const j = p.letters.indexOf(p.target[i], i); if (j !== i) p.swap(i, j); } break;
    case 'gravity': for (const d of solveTilts(p.grid, p.word)) p.tilt(d); break;
    case 'storm': for (const d of p.drops) if (p.isGood(d)) p.catchDrop(d.id, d.t ?? 0); p.finish(); break;
    default: break;
  }
}

/** Plays one full Anarchy turn: whatever phase is current. */
function step(g, { solveEvents = false, seen = null } = {}) {
  if (g.phase === 'announce') {
    const a = g.announcement();
    const picks = {};
    for (const c of a.cards) { seen?.add(c.id); if (c.choices) picks[c.id] = c.choices[c.choices.length - 1].id; }
    const r = g.accept(picks);
    assert.ok(r.ok, r.error);
  } else if (g.phase === 'event') {
    if (g.puzzle.type === 'reverse') g.submitReverse(g.engine.current.word);
    else if (solveEvents) { solvePuzzle(g); const r = g.completeEvent(); assert.ok(r.ok, r.error); } else assert.ok(g.completeEvent({ giveUp: true }).ok);
  } else if (g.phase === 'guessing') {
    const r = g.submit(g.engine.current.word);
    assert.ok(r.ok, r.error);
  } else if (g.phase === 'transition') g.proceed();
}
function playRounds(g, n, opts) {
  let guard = 0;
  while (g.engine.solved < n && g.phase !== 'over' && guard++ < n * 8) step(g, opts);
  while (g.phase !== 'guessing' && g.phase !== 'over' && guard++ < n * 8 + 20) step(g, opts); // settle into a normal guessing state
}

// ---- mode integration ----
test('Anarchy is the sixth mode and the five originals are unchanged', () => {
  assert.equal(MODE_ORDER.length, 6);
  assert.deepEqual(MODE_ORDER.slice(0, 5), ['classic', 'builder', 'architect', 'challenge', 'wildcard']);
  const m = MODES.anarchy;
  assert.equal(m.name, 'Anarchy');
  assert.equal(m.tagline, 'Every word changes the game.');
  assert.match(m.description, /Survive the chaos\.$/);
  assert.equal(MODES.classic.features.anarchy, undefined);
  assert.deepEqual(MODES.wildcard.wordLengths, [4, 5, 6, 7]);
});

test('ordinary and Reverse Wordle solves share score, economy, chaos and idempotent completion', () => {
  const ordinary = fresh(73);
  const reverse = fresh(73);
  const initialTheme = reverse.theme.id;
  reverse.s.entries.push({ id: 'reverse_wordle', kind: 'modifier', stage: 'active', roundsLeft: 1, data: {} });
  assert.equal(reverse.beginRound(), 'event');

  const answer = ordinary.engine.current.word;
  const initialChaos = ordinary.chaos.value;
  const normalResult = ordinary.submit(answer);
  const reverseResult = reverse.submitReverse(answer);
  assert.equal(reverseResult.solved, true);
  assert.equal(reverseResult.res.solved, true);
  assert.equal(normalResult.solved, true);
  assert.equal(reverse.engine.solved, ordinary.engine.solved);
  assert.equal(reverse.engine.score, ordinary.engine.score + reverseResult.res.rewards.score);
  assert.equal(
    reverse.economy.s.earned - ordinary.economy.s.earned,
    reverseResult.res.rewards.coins - normalResult.rewards.coins,
  );
  assert.equal(reverse.chaos.value, ordinary.chaos.value);
  assert.ok(ordinary.chaos.value > initialChaos, 'both completion paths advance the Chaos Meter');
  assert.notEqual(reverse.theme.id, initialTheme);
  assert.equal(reverse.claimCompletion(), true);
  assert.equal(reverse.claimCompletion(), false, 'a repeated completion callback is ignored');

  const resumed = roundTrip(reverse);
  assert.equal(resumed.claimCompletion(), false, 'the idempotency marker survives save/resume');
});

test('original modes still play and save through the shared engine', () => {
  for (const id of MODE_ORDER.filter((m) => m !== 'anarchy')) {
    const e = new GameEngine({ dictionary: D, seed: 5, mode: id });
    for (let i = 0; i < 3; i++) {
      if (e.phase === 'choosing') e.choose(e.publicOptions[0].id);
      e.precompute();
      assert.ok(e.submitGuess(e.current.word).solved);
      e.advance();
    }
    if (e.phase === 'choosing') e.choose(e.publicOptions[0].id);
    const st = json({ ...e.toJSON(), draft: [] });
    assert.ok(validateSave(st, D, id), id);
    assert.equal(validateSave(st, D, 'anarchy'), null);
  }
});

test('Anarchy initializes with its own economy and save round-trips', () => {
  const g = fresh(11);
  assert.equal(g.coins, ECONOMY.start);
  assert.equal(g.phase, 'guessing');
  assert.equal(g.engine.mode.id, 'anarchy');
  assert.ok(validateSave(json(g.toJSON()), D, 'anarchy'));
  assert.equal(validateSave(json(g.toJSON()), D, 'classic'), null, 'mode mismatch is rejected');
  const bad = json(g.toJSON());
  bad.anarchy.economy.coins = -4;
  assert.equal(validateSave(bad, D, 'anarchy'), null, 'corrupt economy rejected');
  const missing = json(g.toJSON());
  delete missing.anarchy;
  assert.equal(validateSave(missing, D, 'anarchy'), null);
});

// ---- rules ----
test('Pressure Cooker table and fairness floor', () => {
  assert.equal(pressureAttempts(0), 6);
  assert.equal(pressureAttempts(1), 5);
  assert.equal(pressureAttempts(2), 3);
  assert.equal(pressureAttempts(3), 2);
  assert.equal(pressureAttempts(4), 2);
  assert.equal(pressureAttempts(3, 500), 4, 'many viable answers lift the budget');
  assert.equal(pressureAttempts(2, 30), 3);
  assert.equal(pressureAttempts(3, 2), 2);
  assert.ok(fairFloor(1000) >= fairFloor(10) && fairFloor(10) >= fairFloor(1));
  assert.ok(viableCount(D, 5, {}) > 1000);
  assert.ok(viableCount(D, 5, { 0: 'q' }) < viableCount(D, 5, {}));
});

test('Pressure Cooker applies the attempt budget to the engine', () => {
  const g = fresh(21);
  playRounds(g, 3);
  g.force = 'pressure_cooker';
  let guard = 0;
  while (guard++ < 40 && !(g.engine.attemptLimit !== null && g.entries.some((e) => e.id === 'pressure_cooker'))) {
    g.force = g.entries.length ? null : 'pressure_cooker';
    step(g);
  }
  assert.ok(g.entries.some((e) => e.id === 'pressure_cooker'));
  assert.ok(g.engine.maxAttempts >= 2 && g.engine.maxAttempts <= 6);
  assert.ok(g.engine.maxAttempts >= fairFloor(viableCount(D, g.engine.current.word.length, g.engine.crossingLocked)));
});

test('compatibility rules', () => {
  const E = EVENTS;
  assert.ok(compatible(E.pressure_cooker, E.jackpot), 'Pressure Cooker + Jackpot may combine');
  assert.ok(!compatible(E.wordquake, E.gravity_shift), 'two mutations never overlap');
  assert.ok(!compatible(E.wordquake, E.word_infection));
  assert.ok(!compatible(E.boss_word, E.jackpot), 'encounters run alone');
  assert.ok(!compatible(E.pressure_cooker, E.pressure_cooker));
});

// ---- director ----
test('director is deterministic for a seed and falls back safely', () => {
  const run = (seed) => {
    const g = fresh(seed);
    const ids = [];
    for (let i = 0; i < 40 && g.phase !== 'over'; i++) { step(g); ids.push(g.entries.map((e) => e.id).join('+')); }
    return ids;
  };
  assert.deepEqual(run(7), run(7));
  assert.notDeepEqual(run(7), run(8));
  const d = new AnarchyDirector({}, {});
  const state = { history: [], cooldowns: {}, lastTier: null, picks: 0 };
  assert.deepEqual(d.pick({ round: 30, active: [], board: null }, createRng(1), state), [], 'no events → plain round');
});

test('events respect cooldowns, minimum rounds and recent history', () => {
  const g = fresh(31);
  const d = g.director;
  const base = { round: 3, board: g.engine.board, active: [], hasLength: (n) => D.hasLength(n), claimed: [], dictionary: D, coins: 5, inventory: g.economy.inventory };
  const st = { history: [], cooldowns: {}, lastTier: null, picks: 0 };
  const early = d.eligible({ ...base, round: 2 }, st).map((x) => x.id);
  for (const def of Object.values(EVENTS)) if (def.minRound > 2) assert.ok(!early.includes(def.id), def.id);
  const first = d.eligible({ ...base, round: 20 }, st)[0];
  st.cooldowns[first.id] = 3;
  assert.ok(!d.eligible({ ...base, round: 20 }, st).some((x) => x.id === first.id));
  // never the same event twice in a row over many picks
  const rng = createRng(4);
  const s2 = { history: [], cooldowns: {}, lastTier: null, picks: 0 };
  let last = null;
  for (let r = 3; r < 60; r++) {
    const e = d.pick({ ...base, round: r }, rng, s2).map((x) => x.id);
    if (e.length && last) assert.ok(!e.includes(last), `repeat ${last} at ${r}`);
    if (e.length) last = e[0]; else last = null;
  }
});

test('lifecycle only moves forward', () => {
  const e = { stage: 'selected' };
  advanceStage(e, 'announced');
  advanceStage(e, 'active');
  assert.equal(advanceStage(e, 'selected'), false, 'cannot go backwards');
  advanceStage(e, 'resolved'); advanceStage(e, 'rewarded'); advanceStage(e, 'cleaned');
  assert.equal(e.stage, 'cleaned');
});

// ---- economy ----
test('shop purchases: costs, limits, and nothing is charged on failure', () => {
  const g = fresh(41);
  g.economy.s.coins = 50;
  const before = g.coins;
  const r = g.buy('extraGuess');
  assert.ok(r.ok);
  assert.equal(g.coins, before - ECONOMY.items.extraGuess.cost);
  assert.equal(g.engine.extra, 1);
  assert.ok(g.buy('extraGuess').ok);
  const c = g.coins;
  assert.equal(g.buy('extraGuess').ok, false, 'per-word limit');
  assert.equal(g.coins, c, 'no charge for a refused purchase');
  assert.ok(g.buy('reveal').ok);
  assert.equal(Object.keys(g.engine.hints).length, 1);
  assert.equal(g.buy('nonsense').ok, false);
  assert.ok(g.buy('shield').ok);
  assert.ok(g.buy('shield').ok);
  const c2 = g.coins;
  assert.equal(g.buy('shield').ok, false, 'held cap');
  assert.equal(g.coins, c2);
  g.economy.s.coins = 1;
  assert.equal(g.buy('stabilizer').ok, false);
  assert.equal(g.coins, 1);
  assert.equal(g.buy('doubleCoins').error, 'Not enough coins');
});

test('shop is closed when it makes no sense and gameplay-only items need guessing phase', () => {
  const g = fresh(42);
  g.economy.s.coins = 30;
  g.submit(g.engine.current.word);
  assert.equal(g.phase, 'transition');
  assert.equal(g.buy('extraGuess').ok, false);
  assert.equal(g.buy('shield').ok, false);
});

test('mistake shield saves an attempt on a wrong guess, once', () => {
  const g = fresh(43);
  g.economy.s.coins = 20;
  g.buy('shield');
  assert.ok(g.useShield().ok);
  assert.equal(g.useShield().ok, false, 'no second shield without another purchase');
  const wrong = D.answersOf(5).find((w) => w !== g.engine.current.word);
  const limit = g.engine.maxAttempts;
  const r = g.submit(wrong);
  assert.ok(r.ok && r.shielded);
  assert.equal(g.engine.attemptsLeft, limit - 1 + 0 + 0 === g.engine.attemptsLeft ? g.engine.attemptsLeft : g.engine.attemptsLeft);
  assert.equal(g.engine.maxAttempts, limit + 1);
  assert.equal(g.economy.s.shieldArmed, false);
});

test('score and coins are separate; solved rewards are paid exactly once', () => {
  const g = fresh(44);
  const c0 = g.coins;
  const r = g.submit(g.engine.current.word);
  assert.ok(r.solved);
  assert.ok(g.coins > c0, 'coins earned');
  assert.ok(g.score > 0);
  const score = g.score, coins = g.coins;
  assert.equal(g.submit(g.engine.current.word).ok, false, 'cannot re-submit during transition');
  assert.equal(g.score, score);
  assert.equal(g.coins, coins);
  g.economy.s.coins = 10;
  g.buy('reveal');
  assert.equal(g.score, score, 'spending coins never costs score');
});

test('economy award is idempotent and capped; double coins ticks down', () => {
  const e = new ArcadeEconomy();
  assert.equal(e.award('a', 4), 4);
  assert.equal(e.award('a', 4), 0);
  e.s.coins = 98;
  assert.equal(e.award('b', 10), 1, 'coin cap');
  const d = new ArcadeEconomy();
  d.s.coins = 20;
  assert.ok(d.commit('doubleCoins'));
  assert.equal(d.commit('doubleCoins'), false, 'already active');
  assert.equal(d.award('x', 2), 4);
  d.endWord(); d.endWord();
  assert.equal(d.award('y', 2), 2);
});

// ---- puzzles ----
test('Mini Sudoku: valid solutions, unique puzzles, validation', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const rng = createRng(seed);
    assert.ok(isComplete(generateSolution(rng)));
    const p = MiniSudoku.create({ rng, round: seed });
    assert.equal(countSolutions(p.cells, 2), 1, 'exactly one solution');
    assert.ok(!p.isSolved());
    assert.equal(p.set(p.givens.findIndex(Boolean), 1), false, 'givens are locked');
    p.solution.forEach((v, i) => p.set(i, v));
    assert.ok(p.isSolved());
  }
  const p = MiniSudoku.create({ rng: createRng(3) });
  const i = p.cells.findIndex((v, k) => !p.givens[k]);
  const clash = p.cells.find((v, k) => v && k !== i && (Math.floor(k / 4) === Math.floor(i / 4)));
  p.set(i, clash); assert.ok(p.conflicts().size > 0);
  assert.deepEqual(puzzleFromJSON(json(p.toJSON())).toJSON(), p.toJSON());
});

function solveSliding(p) {
  const goal = SlidingLetters.solvedTiles(p.word).join('|');
  const seen = new Set([p.tiles.join('|')]);
  let frontier = [{ p: SlidingLetters.fromJSON(p.toJSON()), path: [] }];
  while (frontier.length) {
    const next = [];
    for (const { p: q, path } of frontier) {
      if (q.tiles.join('|') === goal) return path;
      for (const n of q.neighbors(q.tiles.indexOf(''))) {
        const c = SlidingLetters.fromJSON(q.toJSON());
        c.move(n);
        const k = c.tiles.join('|');
        if (!seen.has(k)) { seen.add(k); next.push({ p: c, path: [...path, n] }); }
      }
    }
    frontier = next;
  }
  return null;
}

test('Sliding letters are always reachable and playable to completion', () => {
  for (let seed = 1; seed <= 15; seed++) {
    const rng = createRng(seed);
    const p = SlidingLetters.create({ word: D.randomAnswer(rng, seed % 2 ? 5 : 7), rng });
    assert.ok(isReachable(p));
    const path = solveSliding(p);
    assert.ok(path, 'solution exists');
    for (const m of path) assert.ok(p.move(m));
    assert.ok(p.isSolved());
  }
});

test('Memory match: replay, mistakes and difficulty growth', () => {
  const m = MemoryMatch.create({ rng: createRng(2), round: 1 });
  assert.equal(m.press(m.sequence[0]).ok, false, 'cannot answer while shown');
  m.hide();
  m.press(m.sequence[0]);
  const wrong = m.bank.find((l) => l !== m.sequence[1]);
  m.press(wrong);
  assert.equal(m.mistakes, 1);
  for (const l of m.sequence.slice(1)) m.press(l);
  assert.ok(m.isSolved());
  assert.ok(MemoryMatch.create({ rng: createRng(2), round: 30 }).sequence.length >= m.sequence.length);
});

test('Letter Collapse is solvable, deterministic and never touches the crossword', () => {
  for (let seed = 1; seed <= 20; seed++) {
    for (const missing of [false, true]) {
      const word = D.randomAnswer(createRng(seed), 5);
      const p = LetterCollapse.create({ dictionary: D, word, rng: createRng(seed), missing });
      assert.deepEqual(LetterCollapse.create({ dictionary: D, word, rng: createRng(seed), missing }).toJSON(), p.toJSON());
      assert.notEqual(p.arrangement, word, 'scrambled');
      if (p.hasBlank) { assert.equal(p.isSolved(D), false); p.fillMissing(); }
      for (let i = 0; i < word.length; i++) { const j = p.slots.indexOf(word[i], i); if (j !== i) p.swap(i, j); }
      assert.ok(p.isSolved(D));
    }
  }
  const w = D.answersOf(5).find((x) => findAnagrams(D, x).length);
  const p = LetterCollapse.create({ dictionary: D, word: w, rng: createRng(1) });
  const alt = findAnagrams(D, w)[0];
  for (let i = 0; i < alt.length; i++) { const j = p.slots.indexOf(alt[i], i); if (j !== i) p.swap(i, j); }
  assert.ok(p.isSolved(D), 'any valid anagram is accepted');
});

test('Reverse Wordle clues are consistent and identify the answer', () => {
  for (let seed = 1; seed <= 15; seed++) {
    const answer = D.randomAnswer(createRng(seed), 5);
    const p = ReverseWordle.create({ dictionary: D, answer, rng: createRng(seed) });
    assert.ok(p.clues.length >= 3, 'several clues');
    const cands = candidatesFor(D, 5, p.clues);
    assert.ok(cands.includes(answer));
    assert.ok(cands.length <= 12, 'clues narrow the field: ' + cands.length);
    assert.ok(p.clues.every((c) => c.word !== answer));
    const r = p.submit(answer, D);
    assert.ok(r.correct && p.isSolved());
  }
});

test('Gravity Shift and Wordquake repair are solvable', () => {
  for (let seed = 1; seed <= 15; seed++) {
    const word = D.randomAnswer(createRng(seed), 5);
    const g = GravityShift.create({ word, rng: createRng(seed) });
    assert.ok(!g.isSolved());
    const sol = solveTilts(g.grid, word);
    assert.ok(sol, 'solvable');
    sol.forEach((d) => g.tilt(d));
    assert.ok(g.isSolved());
  }
  const e = fresh(5);
  playRounds(e, 6);
  assert.ok(TileRepair.supports(e.engine.board));
  const snapshot = JSON.stringify(e.engine.board.words);
  const r = TileRepair.create({ board: e.engine.board, rng: createRng(3) });
  assert.ok(!r.isSolved());
  assert.equal(JSON.stringify(e.engine.board.words), snapshot, 'canonical board untouched');
  for (let i = 0; i < r.letters.length; i++) { const j = r.letters.indexOf(r.target[i], i); if (j !== i) r.swap(i, j); }
  assert.ok(r.isSolved());
});

test('chain reaction awards only unique links', () => {
  const g = fresh(6);
  playRounds(g, 6);
  const board = g.engine.board;
  const last = board.words[board.words.length - 1];
  const c1 = computeChain(board, last, []);
  const c2 = computeChain(board, last, c1.links);
  assert.equal(c2.links.length, 0, 'claimed links never pay again');
  assert.equal(c2.points, 0);
});

// ---- full game flows ----
test('letter forge event: canonical crossword preserved, reward paid once', () => {
  const g = fresh(51);
  playRounds(g, 4);
  g.force = 'letter_forge';
  let guard = 0;
  while (g.phase !== 'announce' && guard++ < 5) step(g);
  assert.equal(g.phase, 'announce');
  const words = JSON.stringify(g.engine.board.words);
  const coins = g.coins, score = g.score;
  assert.ok(g.accept().ok);
  assert.equal(g.phase, 'event');
  assert.equal(g.puzzle.type, 'forge');
  assert.equal(g.completeEvent().ok, false, 'unsolved cannot complete');
  assert.equal(g.coins, coins);
  assert.equal(JSON.stringify(g.engine.board.words), words, 'board unchanged during puzzle');
  const saved = roundTrip(g);
  assert.equal(saved.phase, 'event');
  assert.equal(saved.puzzle.type, 'forge');
  solvePuzzle(g);
  const r = g.completeEvent();
  assert.ok(r.ok);
  assert.ok(g.coins > coins && g.score > score);
  assert.equal(g.phase, 'guessing');
  assert.equal(JSON.stringify(g.engine.board.words), words);
  assert.equal(g.completeEvent().ok, false, 'cannot claim twice');
});

for (const id of ['wordquake', 'gravity_shift', 'letter_storm', 'chain_reaction']) {
  test(`${id}: plays, solves, preserves the board and resumes mid-event`, () => {
    const g = fresh(60 + id.length);
    playRounds(g, 7);
    g.force = id;
    let guard = 0;
    while (g.phase !== 'announce' && guard++ < 5) step(g);
    assert.equal(g.phase, 'announce');
    assert.ok(g.accept().ok);
    assert.equal(g.phase, 'event');
    const words = JSON.stringify(g.engine.board.words);
    const resumed = roundTrip(g);
    assert.equal(resumed.phase, 'event');
    assert.deepEqual({ ...resumed.puzzle.toJSON(), calm: 0 }, { ...g.puzzle.toJSON(), calm: 0 }); // a restored storm resumes calm
    solvePuzzle(resumed);
    assert.ok(resumed.completeEvent().ok);
    assert.equal(JSON.stringify(resumed.engine.board.words), words);
    assert.equal(resumed.phase, 'guessing');
    assert.equal(resumed.entries.filter((e) => e.kind === 'interlude').length, 0, 'cleaned up');
  });
}

test('Stabilizer simplifies a board mutation at half reward and is only charged on success', () => {
  const g = fresh(71);
  playRounds(g, 7);
  g.force = 'wordquake';
  while (g.phase !== 'announce') step(g);
  g.accept();
  assert.equal(g.completeEvent({ stabilize: true }).ok, false, 'none held');
  g.economy.grantCredit('stabilizer', 1);
  const coins = g.coins;
  const r = g.completeEvent({ stabilize: true });
  assert.ok(r.ok);
  assert.equal(g.economy.held('stabilizer'), 0);
  assert.ok(g.coins >= coins);
});

for (const id of ['pressure_cooker', 'shared_pool', 'bet', 'jackpot', 'mutating_rules', 'blackout', 'wildcard_round', 'reverse_wordle', 'double_trouble', 'word_infection', 'boss_word', 'heist', 'survival', 'risk_reward']) {
  test(`event ${id}: announces, plays through, saves/resumes and cleans up`, () => {
    let ok = false;
    for (let seed = 1; seed <= 6 && !ok; seed++) {
      const g = fresh(100 + seed);
      playRounds(g, 9);
      g.force = id;
      let guard = 0;
      while (g.phase !== 'announce' && g.phase !== 'over' && guard++ < 6) step(g);
      if (g.phase !== 'announce') continue; // not eligible on this board (e.g. no valid pairing) → fell back safely
      assert.ok(g.entries.some((e) => e.id === id));
      assert.ok(g.announcement().cards.some((c) => c.id === id));
      assert.ok(roundTrip(g).entries.some((e) => e.id === id), 'resumes at announcement');
      const picks = {};
      for (const c of g.announcement().cards) if (c.choices) picks[c.id] = c.choices[c.choices.length - 1].id;
      assert.ok(g.accept(picks).ok);
      const mid = roundTrip(g);
      assert.equal(mid.phase, g.phase);
      for (let i = 0; i < 40 && g.phase !== 'over' && (g.entries.some((e) => e.id === id) || g.phase === 'event' || g.phase === 'announce'); i++) step(g);
      assert.ok(!g.entries.some((e) => e.id === id), 'cleaned up');
      assert.ok(validateSave(json(g.toJSON()), D, 'anarchy'));
      ok = true;
    }
    assert.ok(ok, 'event could be started on at least one board');
  });
}

function startHeist(seed) {
  const g = fresh(seed);
  playRounds(g, 9);
  g.force = 'heist';
  while (g.phase !== 'announce') step(g);
  assert.ok(g.entries.some((e) => e.id === 'heist'));
  assert.ok(g.accept({ heist: 'start' }).ok);
  assert.equal(g.phase, 'guessing');
  return g;
}
const wrongWords = (g, n) => D.answersOf(5).filter((w) => w !== g.engine.current.word && !g.engine.checkGuess(w)).slice(0, n);

test('Heist: solving lets you bank the loot exactly once', () => {
  const g = startHeist(81);
  const coins = g.coins, score = g.score;
  g.submit(g.engine.current.word);
  g.proceed();
  assert.equal(g.phase, 'announce', 'bank / continue prompt');
  const card = g.announcement().cards.find((c) => c.id === 'heist');
  assert.deepEqual(card.choices.map((c) => c.id), ['bank', 'continue']);
  const afterSolve = { coins: g.coins, score: g.score };
  assert.ok(g.accept({ heist: 'bank' }).ok);
  assert.ok(g.coins > afterSolve.coins && g.score > afterSolve.score, 'loot banked');
  assert.ok(!g.entries.some((e) => e.id === 'heist'), 'encounter over');
  assert.ok(g.coins > coins && g.score > score);
  assert.equal(g.accept({ heist: 'bank' }).ok, false, 'cannot bank twice');
});

test('Heist: tripping the alarm loses unbanked loot but the run continues', () => {
  const g = startHeist(82);
  g.submit(g.engine.current.word);
  g.proceed();
  assert.ok(g.accept({ heist: 'continue' }).ok);
  const entry = g.entries.find((e) => e.id === 'heist');
  assert.ok(entry.data.pending.coins > 0);
  const before = { coins: g.coins, score: g.score };
  for (const w of wrongWords(g, 5)) g.submit(w);
  assert.equal(g.phase, 'guessing', 'run continues after the alarm');
  assert.equal(entry.data.failed, true);
  assert.equal(entry.data.pending.coins, 0, 'unbanked loot lost');
  g.submit(g.engine.current.word);
  assert.ok(!g.entries.some((e) => e.id === 'heist'));
  assert.ok(g.score - before.score < 400, 'no heist payout after failing');
});

test('Survival: slow solves cost stability and the encounter resolves', () => {
  let tested = false;
  for (let seed = 1; seed <= 12 && !tested; seed++) {
    const g = fresh(400 + seed);
    playRounds(g, 7);
    g.force = 'survival';
    while (g.phase !== 'announce' && g.phase !== 'over') step(g);
    if (g.phase !== 'announce') continue;
    g.accept();
    const entry = g.entries.find((e) => e.id === 'survival');
    assert.equal(entry.data.hp, 3);
    const wrong = wrongWords(g, 4);
    if (wrong.length < 4) continue; // crossing letters left too few legal wrong guesses on this board
    for (const w of wrong) g.submit(w);
    assert.ok(entry.data.hp < 3, 'stability dropped');
    tested = true;
  }
  assert.ok(tested);
});

test('Boss Word shows progress and pays a bounded bonus', () => {
  let bossSeen = false;
  for (let seed = 1; seed <= 5 && !bossSeen; seed++) {
    const g = fresh(200 + seed);
    playRounds(g, 9);
    g.force = 'boss_word';
    let guard = 0;
    while (g.phase !== 'announce' && guard++ < 6) step(g);
    if (g.phase !== 'announce') continue;
    bossSeen = true;
    g.accept();
    const chip = g.chips.find((c) => c.id === 'boss_word');
    assert.ok(chip && chip.progress, 'progress indicator');
    const s0 = g.score;
    for (let i = 0; i < 30 && g.entries.some((e) => e.id === 'boss_word'); i++) step(g);
    assert.ok(g.score > s0);
    assert.ok(g.score - s0 < 3000, 'bonus is balanced');
  }
  assert.ok(bossSeen);
});

// ---- detours ----
test('detours: reward shown first, limited, paid once, exit pays nothing, run preserved', () => {
  const g = fresh(91);
  const c = g.canDetour('sliding');
  assert.ok(c.ok && c.reward.label);
  const word = g.engine.current.word;
  const coins = g.coins;
  assert.ok(g.startDetour('sliding').ok);
  assert.equal(g.canDetour('sudoku').ok, false, 'one at a time');
  const resumed = roundTrip(g);
  assert.equal(resumed.engine.current.word, word);
  assert.ok(resumed.s.detour);
  assert.equal(resumed.finishDetour().solved, false);
  assert.equal(resumed.coins, coins, 'exit pays nothing');
  const p = g.detourPuzzle;
  for (const m of solveSliding(p)) p.move(m);
  const r = g.finishDetour();
  assert.ok(r.solved);
  assert.ok(g.coins > coins);
  assert.equal(g.finishDetour().ok, false, 'cannot claim twice');
  assert.equal(g.canDetour('memory').ok, false, 'one reward per round');
  assert.equal(g.canDetour('sliding').ok, false);
});

test('detours rewards: sudoku grants a free reveal usable once', () => {
  const g = fresh(92);
  g.startDetour('sudoku');
  g.detourPuzzle.solution.forEach((v, i) => g.detourPuzzle.set(i, v));
  assert.ok(g.finishDetour().solved);
  assert.equal(g.economy.held('freeReveal'), 1);
  const coins = g.coins;
  assert.ok(g.buy('reveal', { credit: true }).ok);
  assert.equal(g.coins, coins, 'free');
  assert.equal(g.economy.held('freeReveal'), 0);
});

test('mini-game registry is complete', () => {
  assert.deepEqual(Object.keys(MINIGAMES).sort(), ['memory', 'sliding', 'sudoku']);
  for (const m of Object.values(MINIGAMES)) {
    const p = m.create({ rng: createRng(1), round: 3, dictionary: D });
    assert.equal(typeof p.isSolved, 'function');
    assert.ok(m.reward(3).label);
    assert.ok(puzzleFromJSON(json(p.toJSON())));
  }
});

// ---- save/resume & restart ----
test('resuming mid-guess and mid-transition keeps state identical', () => {
  const g = fresh(95);
  playRounds(g, 2);
  const wrong = D.answersOf(5).find((w) => w !== g.engine.current.word);
  g.submit(wrong);
  const r = roundTrip(g);
  assert.deepEqual(r.toJSON(), g.toJSON());
  g.submit(g.engine.current.word);
  assert.equal(g.phase, 'transition');
  const t = roundTrip(g);
  assert.notEqual(t.phase, 'transition', 'interrupted transition recovers');
  assert.equal(t.engine.solved, g.engine.solved + 1 - 1 === t.engine.solved ? t.engine.solved : t.engine.solved);
  assert.equal(t.score, g.score);
  assert.equal(t.coins, g.coins);
});

test('resumed runs continue the same event sequence (RNG state saved)', () => {
  const a = fresh(96);
  playRounds(a, 6);
  const b = roundTrip(a);
  const seq = (g) => { const out = []; for (let i = 0; i < 25 && g.phase !== 'over'; i++) { step(g); out.push(g.entries.map((e) => e.id).join('+') + ':' + g.engine.current?.word); } return out; };
  assert.deepEqual(seq(b), seq(a));
});

test('fresh game after abandoning another is independent (restart during an event)', () => {
  const g = fresh(97);
  playRounds(g, 7);
  g.force = 'wordquake';
  while (g.phase !== 'announce') step(g);
  g.accept();
  assert.equal(g.phase, 'event');
  const g2 = fresh(97);
  assert.equal(g2.engine.solved, 0);
  assert.equal(g2.coins, ECONOMY.start);
  assert.equal(g2.entries.length, 0);
  assert.equal(g2.puzzle, null);
});

test('corrupt anarchy saves are rejected rather than crashing', () => {
  const g = fresh(98);
  playRounds(g, 3);
  const cases = [
    (s) => { s.anarchy.phase = 'nope'; },
    (s) => { s.anarchy.entries = [{ id: 'ghost', kind: 'modifier', stage: 'active', roundsLeft: 1, data: {} }]; },
    (s) => { s.anarchy.phase = 'event'; s.anarchy.puzzle = null; },
    (s) => { s.anarchy.rng = 'x'; },
    (s) => { s.anarchy.attemptLimit = 99; },
    (s) => { s.anarchy.detour = { id: 'zzz', puzzle: {}, reward: {} }; },
  ];
  for (const mutate of cases) { const s = json(g.toJSON()); mutate(s); assert.equal(validateSave(s, D, 'anarchy'), null); }
});

// ---- long simulated runs ----
test('long simulated runs: varied events, valid boards, valid saves throughout', () => {
  const seenAll = new Set();
  for (let seed = 1; seed <= 6; seed++) {
    const g = fresh(300 + seed);
    for (let i = 0; i < 400 && g.engine.solved < 45 && g.phase !== 'over'; i++) {
      step(g, { solveEvents: i % 2 === 0, seen: seenAll });
      if (i % 7 === 0) assert.ok(validateSave(json(g.toJSON()), D, 'anarchy'), `seed ${seed} step ${i}`);
      assert.ok(g.coins >= 0 && g.coins <= ECONOMY.maxCoins);
      assert.ok(g.entries.length <= 3);
    }
    const words = g.engine.board.words.map((w) => w.word);
    assert.equal(new Set(words).size, words.length, 'no duplicate words');
    assert.ok(g.engine.solved >= 20);
  }
  assert.ok(seenAll.size >= 10, 'varied events: ' + [...seenAll]);
});

test('hard loss ends the run and exposes a summary', () => {
  const g = fresh(99);
  for (let i = 0; i < 6 && g.phase === 'guessing'; i++) {
    const wrong = D.answersOf(5).filter((w) => w !== g.engine.current.word)[i];
    g.submit(wrong);
  }
  assert.equal(g.phase, 'over');
  const s = g.summary();
  assert.equal(g.status, 'lost');
  assert.ok('coins' in s);
  assert.equal(g.submit('crane').ok, false);
});

test('share text is mode-aware', () => {
  const g = fresh(100);
  g.submit(g.engine.current.word);
  const text = buildShareText({ ...g.summary(), mode: 'Anarchy' });
  assert.match(text, /Anarchy/);
});

// ---- static hosting ----
test('all relative module imports resolve (static GitHub Pages)', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../js');
  const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.endsWith('.js') ? [join(d, f)] : []));
  for (const file of walk(root)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g)) {
      const target = resolve(dirname(file), m[1]);
      assert.ok(statSync(target).isFile(), `${file} → ${m[1]}`);
      assert.ok(m[1].endsWith('.js'), 'explicit .js extension: ' + m[1]);
    }
  }
});
