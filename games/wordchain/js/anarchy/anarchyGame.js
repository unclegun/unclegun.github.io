import { GameEngine } from '../gameEngine.js';
import { createRng } from '../random.js';
import { cellsOf, key, validatePlacement } from '../placementValidator.js';
import { CORRECT } from '../wordleEvaluator.js';
import { ArcadeEconomy, ECONOMY } from './arcadeEconomy.js';
import { AnarchyDirector, advanceStage } from './anarchyDirector.js';
import { EVENTS } from './eventRegistry.js';
import { viableCount, fairFloor, clampAttempts } from './eventRules.js';
import { wordRewards } from './anarchyScoring.js';
import * as Chaos from './chaosMeter.js';
import { themeFor } from './themeDirector.js';
import { newAnarchyState } from './anarchyState.js';
import { puzzleFromJSON, MINIGAMES, DETOUR_LIMITS } from './puzzles/index.js';
import { ConsequenceManager, EFFECT_TYPES } from './consequences.js';
import { ReverseWordle } from './puzzles/reverseWordle.js';
import { INFECTION } from './puzzles/infection.js';

const hooked = (e) => e.kind === 'modifier' || e.kind === 'encounter';
const def = (e) => EVENTS[e.id];
const hook = (e, name) => def(e)?.hooks?.[name];

/**
 * The Anarchy orchestrator. It composes the shared GameEngine (crossword, Wordle rules, scoring) with the
 * Anarchy subsystem (director, modifiers, encounters, economy, puzzles). It is the single authority for run
 * state and contains no DOM code. The UI calls its methods and re-renders from its state.
 *
 * Phases: guessing → (solved) transition → proceed() → announce | guessing; announce → accept() → event | guessing;
 * event → completeEvent() → guessing. Rewards are applied exactly once at solve time and recorded.
 */
export class AnarchyGame {
  constructor({ dictionary, seed = Date.now(), saved = null, director = new AnarchyDirector(), reduceMotion = false, force = null }) {
    this.dictionary = dictionary;
    this.director = director;
    this.reduceMotion = reduceMotion;
    this.force = force; // tests/debug: event id to force at the next pick
    if (saved) {
      this.engine = new GameEngine({ dictionary, state: saved });
      this.s = JSON.parse(JSON.stringify(saved.anarchy));
    } else {
      this.engine = new GameEngine({ dictionary, seed, mode: 'anarchy' });
      this.s = newAnarchyState(seed);
    }
    if (!this.s.chaos) this.s.chaos = Chaos.newChaosState(); // migrate saves from before the Chaos Meter
    if (!Number.isInteger(this.s.themeSeed)) this.s.themeSeed = (this.s.rng >>> 0) % 997;
    this.rng = createRng(1);
    this.rng.setState(this.s.rng);
    this.economy = new ArcadeEconomy(this.s.economy);
    this.consequences = new ConsequenceManager(this.s.consequences);
    this.puzzle = this.s.puzzle ? puzzleFromJSON(this.s.puzzle) : null;
    this.detourPuzzle = this.s.detour ? puzzleFromJSON(this.s.detour.puzzle) : null;
    if (saved) this.#recover();
  }

  // ---- state access ----
  get phase() { return this.s.phase; }
  get status() { return this.engine.status; }
  get round() { return this.engine.solved + (this.s.phase === 'transition' || this.s.phase === 'over' ? 0 : 1); }
  get score() { return this.engine.score; }
  get coins() { return this.economy.coins; }
  get entries() { return this.s.entries; }
  get detour() { return this.s.detour; }
  get chaos() { return this.s.chaos; }
  /** Palette for the current run position (changes after every solved word). */
  get theme() { return themeFor(this.s.themeSeed, this.engine.solved); }
  get cfg() { return this.engine.mode.anarchy; }

  #recover() {
    this.engine.attemptLimit = this.s.attemptLimit;
    if (this.s.phase === 'transition') this.proceed();
  }

  #ctx(extra = {}) {
    const board = this.engine.board;
    return {
      round: this.engine.solved + 1, board, lastWord: board.words[board.words.length - 1] || null, coins: this.economy.coins, inventory: this.economy.inventory,
      active: this.s.entries, hasLength: (n) => this.dictionary.hasLength(n), claimed: this.s.claimed, dictionary: this.dictionary, reduceMotion: this.reduceMotion, ...extra,
    };
  }

  /** Round context handed to hooks. `pre` carries the crossing information captured before the word was placed. */
  #rc(pre = null) {
    const e = this.engine;
    const locked = pre ? pre.locked : e.locked;
    const known = pre ? pre.known : Object.keys(e.crossingLocked).length;
    const len = e.current?.word.length || 5;
    const viable = e.current ? viableCount(this.dictionary, len, pre ? pre.crossing : e.crossingLocked) : 0;
    return { round: pre ? e.solved : e.solved + 1, current: e.current, locked, known, viable, floor: fairFloor(viable), dictionary: this.dictionary, board: e.board, rng: this.rng, engine: e, economy: this.economy, crossingKeys: e.current ? cellsOf(e.current.word, e.current.x, e.current.y, e.current.dir).map((c) => key(c.x, c.y)) : [], placed: pre ? e.board.words[e.board.words.length - 1] : null };
  }

  #activeHooks() { return this.s.entries.filter((e) => hooked(e) && e.stage === 'active'); }

  // ---- round setup ----
  /** Applies attempt budgets from active modifiers (with the fairness floor) and opens a Reverse Wordle puzzle if needed. */
  beginRound() {
    const e = this.engine;
    this.s.phase = 'guessing';
    this.s.wordShields = 0;
    const rc = this.#rc();
    const limits = this.#activeHooks().map((en) => hook(en, 'attempts')?.(en, rc)).filter((n) => Number.isInteger(n));
    let limit = limits.length ? Math.min(...limits) : null;
    if (limit !== null) limit = clampAttempts(limit, rc.viable);
    if (limit !== null && limit >= e.mode.attempts) limit = limit > e.mode.attempts ? limit : null;
    e.attemptLimit = limit;
    this.s.attemptLimit = limit;
    this.consequences.expire(e.solved + 1);
    const rev = this.#activeHooks().find((en) => en.id === 'reverse_wordle');
    if (!rev) this.#applyRoundStartEffects();
    if (rev && !this.puzzle) {
      this.puzzle = ReverseWordle.create({ dictionary: this.dictionary, answer: e.current.word, rng: this.rng });
      this.s.puzzleEntry = rev.id;
      this.s.phase = 'event';
    }
    return this.s.phase;
  }

  /** Applies carried-over 'roundStart' consequences exactly once (an effect that cannot apply yet stays queued until it expires). */
  #applyRoundStartEffects() {
    const e = this.engine;
    const used = [];
    for (const fx of [...this.consequences.active]) {
      if (fx.trigger !== 'roundStart') continue;
      let ok = false;
      if (fx.type === 'startHint') {
        for (let n = 0; n < fx.magnitude; n++) {
          const unknown = Object.keys(e.hints).length >= this.cfg.maxHints ? [] : this.#unknownIndex();
          if (!unknown.length) break;
          const index = unknown[this.rng.int(unknown.length)];
          e.hints[index] = e.current.word[index];
          ok = true;
        }
      } else if (fx.type === 'freeGuess' && e.extra < this.cfg.maxExtra) { e.extra++; ok = true; }
      else if (fx.type === 'shield' && !this.economy.s.shieldArmed) { this.economy.s.shieldArmed = true; ok = true; }
      if (ok) { this.consequences.take(fx.type); used.push(fx.label); }
    }
    if (used.length) this.s.note = `Applied: ${used.join('; ')}`;
  }

  /** Attempts the player must not exceed to earn the current goal bonus, or null. */
  get goal() {
    const rc = this.#rc();
    const goals = this.#activeHooks().map((en) => hook(en, 'goal')?.(en, rc)).filter((n) => Number.isInteger(n));
    return goals.length ? Math.min(...goals) : null;
  }

  // ---- guessing ----
  submit(word) {
    if (this.s.phase !== 'guessing' || this.engine.status !== 'playing') return { ok: false, error: 'Not accepting guesses' };
    const e = this.engine;
    const error = e.checkGuess(word);
    if (error) return { ok: false, error };
    const w = word.toLowerCase();
    const pre = { locked: { ...e.locked }, crossing: { ...e.crossingLocked }, known: Object.keys(e.crossingLocked).length + Object.keys(e.hints).length };
    let shielded = false;
    if (this.economy.s.shieldArmed && w !== e.current.word && e.extra < this.cfg.maxExtra) {
      e.extra++;
      this.economy.s.shieldArmed = false;
      this.s.wordShields = (this.s.wordShields || 0) + 1;
      shielded = true;
    }
    const attemptNumber = e.guesses.length + 1 - (this.s.wordShields || 0);
    const res = e.submitGuess(w);
    res.shielded = shielded;
    const info = { solved: !!res.solved, attemptNumber, attempts: e.guesses.length - (this.s.wordShields || 0), guesses: e.guesses, hints: Object.keys(e.hints).length };
    if (!res.solved) {
      res.notes = this.#runGuessHooks(info);
      if (res.lost) this.s.phase = 'over';
      return res;
    }
    this.#onSolved(res, info, pre);
    return res;
  }

  #runGuessHooks(info) {
    const rc = this.#rc();
    const notes = [];
    for (const en of this.#activeHooks()) {
      const r = hook(en, 'onGuess')?.(en, info, rc);
      if (r) notes.push({ id: en.id, ...r });
    }
    return notes;
  }

  #onSolved(res, info, pre) {
    const e = this.engine;
    const round = e.solved;
    const paidKey = `w${round}`;
    if (this.s.paid.includes(paidKey)) return;
    this.s.paid.push(paidKey);
    if (this.s.paid.length > 80) this.s.paid.shift();
    const rc = this.#rc(pre);
    const crossings = e.history[e.history.length - 1]?.crossings || 0;
    const entries = this.#activeHooks();
    const hookResults = entries.map((en) => hook(en, 'onSolved')?.(en, info, rc) || null);
    const r = wordRewards({ baseScore: res.breakdown.total, info: { attempts: info.attempts, hints: info.hints, crossings }, hookResults });
    const coins = this.economy.award(`${paidKey}:coins`, r.coins);
    const delta = Math.max(r.scoreBonus, -e.score);
    e.score += delta;
    const last = e.history[e.history.length - 1];
    if (last) last.points += delta;
    this.s.stats.bonusScore += Math.max(0, delta);
    res.breakdown.total += delta;
    res.breakdown.tokens = coins;
    for (const it of r.items) {
      if (it.points || it.coins) res.breakdown.items.push({ label: `${it.label}${it.coins ? ` (+${it.coins}🪙)` : ''}`, points: it.points });
      else if (it.label !== 'Word solved') res.breakdown.items.push({ label: it.label, points: 0 });
    }
    res.rewards = { coins, score: delta, items: r.items, jackpot: hookResults.some((x) => x?.jackpot), boss: hookResults.some((x) => x?.boss) };
    const carried = this.consequences.take('solveBonus');
    if (carried) {
      const extra = this.economy.award(`${paidKey}:cons`, carried.magnitude);
      res.breakdown.tokens += extra;
      res.rewards.coins += extra;
      res.breakdown.items.push({ label: `${carried.source === 'letter_forge' ? 'Forge bonus' : 'Carried bonus'} (+${extra}🪙)`, points: 0 });
    }
    this.economy.endWord();
    Chaos.onWordSolved(this.s.chaos, { attempts: info.attempts, crossings, hard: info.attempts >= 5 || hookResults.some((x) => x?.boss) });
    const wasDouble = this.#finishEntries(entries, info);
    this.#planNext(wasDouble);
  }

  /** Decrements durations, pays encounter payouts and cleans up finished entries. Returns the entry that continues as Double Trouble B, if any. */
  #finishEntries(entries, info) {
    let doubleB = null;
    let finishedEncounter = false;
    for (const en of entries) {
      if (en.id === 'double_trouble' && en.data.stage === 'A') {
        en.data.used = info.attempts;
        en.data.stage = 'B';
        doubleB = en;
        continue;
      }
      if (en.roundsLeft !== null) en.roundsLeft--;
      const done = en.data.done || (en.roundsLeft !== null && en.roundsLeft <= 0);
      if (en.data.payout) this.#payout(en);
      if (done) {
        if (en.kind === 'encounter') finishedEncounter = true;
        this.#cleanup(en);
      }
    }
    this.s.finishedEncounter = finishedEncounter;
    return doubleB;
  }

  #payout(en) {
    const p = en.data.payout;
    en.data.payout = null;
    this.economy.award(`payout:${en.id}:${this.engine.solved}`, p.coins || 0);
    if (p.score) { this.engine.score += p.score; this.s.stats.bonusScore += p.score; }
    this.s.note = p.label || null;
  }

  #cleanup(en) {
    advanceStage(en, 'resolved');
    advanceStage(en, 'rewarded');
    advanceStage(en, 'cleaned');
    this.s.stats.events[en.id] = (this.s.stats.events[en.id] || 0) + 1;
    this.s.entries = this.s.entries.filter((x) => x !== en);
  }

  #planNext(doubleB) {
    const plan = { entries: [], forced: null, queued: null };
    const round = this.engine.solved;
    const rc = this.#rc();
    const encounter = this.s.entries.find((en) => en.kind === 'encounter');
    if (doubleB) plan.queued = doubleB.data.second;
    else if (encounter) hook(encounter, 'prepare')?.(encounter, plan, rc);
    else {
      if (this.s.finishedEncounter) this.s.director.lastTier = 'major'; // recovery after an encounter
      const kind = Chaos.nextKind(this.s.chaos);
      const picked = this.director.pick(this.#ctx({ round: round + 1 }), this.rng, this.s.director, { force: this.force, tier: kind });
      this.force = null;
      const tiers = picked.map((p) => EVENTS[p.id].tier);
      const top = tiers.some((t) => t === 'major' || t === 'rare') ? 'major' : picked.length ? 'minor' : 'none';
      if (top === 'major' && this.s.chaos.catalyst) this.economy.award(`catalyst:${round}`, Chaos.CHAOS.catalystBonusCoins, { doubling: false });
      Chaos.recordPick(this.s.chaos, top === 'none' ? null : top);
      this.s.lastPick = top;
      for (const en of picked) {
        hook(en, 'prepare')?.(en, plan, rc);
        plan.entries.push(en);
      }
    }
    this.s.finishedEncounter = false;
    this.s.plan = plan;
    this.s.phase = 'transition';
  }

  /** After the solved-word celebration: places the next word and starts the announced event (if any). */
  proceed() {
    if (this.s.phase !== 'transition') return null;
    const plan = this.s.plan;
    const e = this.engine;
    e.forcedLengths = plan.forced;
    e.queued = plan.queued;
    e.advance();
    this.s.plan = null;
    if (e.status !== 'playing') { this.s.phase = 'over'; return { complete: e.status === 'complete' }; }
    for (const en of plan.entries) {
      advanceStage(en, 'announced');
      this.s.entries.push(en);
    }
    for (const en of [...this.s.entries]) {
      if (en.id === 'wildcard_round') en.data.length = e.current.word.length;
      if (en.id === 'double_trouble' && en.data.stage === 'A' && !this.#pairWord(en)) this.#discard(en);
    }
    this.s.attemptLimit = null;
    const waiting = this.s.entries.some((x) => x.stage === 'announced' || x.data.awaiting);
    if (waiting) {
      this.s.phase = 'announce';
      e.attemptLimit = null;
    } else this.beginRound();
    return { phase: this.s.phase };
  }

  #discard(en) {
    this.s.entries = this.s.entries.filter((x) => x !== en);
  }

  /** Double Trouble: picks the hidden linked word that crosses the active one; false if the board cannot support it. */
  #pairWord(en) {
    const e = this.engine;
    const A = e.current;
    const projected = e.board.clone();
    projected.addWord(A.word, A.x, A.y, A.dir);
    const aKeys = new Set(cellsOf(A.word, A.x, A.y, A.dir).map((c) => key(c.x, c.y)));
    const cands = e.generator.findCandidates(projected, 8, { wordNumber: e.solved + 2, lengths: [5] });
    const pick = cands.find((c) => c.word !== A.word && !projected.has(c.word) && cellsOf(c.word, c.x, c.y, c.dir).some((cc) => aKeys.has(key(cc.x, cc.y))) && validatePlacement(projected, c.word, c.x, c.y, c.dir).ok);
    if (!pick) return false;
    en.data.second = { word: pick.word, x: pick.x, y: pick.y, dir: pick.dir };
    return true;
  }

  // ---- announcements ----
  /** Event card content for the announce phase. Never reveals answers. */
  announcement() {
    if (this.s.phase !== 'announce') return null;
    const cards = [];
    const ctx = this.#ctx();
    for (const en of this.s.entries) {
      const d = def(en);
      const announced = en.stage === 'announced';
      if (!announced && !en.data.awaiting) continue;
      const choices = hook(en, 'choices')?.(en, ctx) || null;
      cards.push({ id: en.id, name: d.name, icon: d.icon, tier: d.tier, kind: en.kind, text: announced ? d.describe(en) : `${d.name}: your loot is unbanked. Bank it, or push your luck?`, choices, roulette: !!d.roulette, rerollable: announced && !!d.rerollable });
    }
    return { cards, canReroll: cards.some((c) => c.rerollable) && this.economy.held('reroll') > 0, rerolls: this.economy.held('reroll') };
  }

  /** Accepts the announced event(s). `picks` maps entry id -> choice id for events that offer choices. */
  accept(picks = {}) {
    if (this.s.phase !== 'announce') return { ok: false, error: 'Nothing to accept' };
    const ctx = this.#ctx();
    const pending = this.s.entries.filter((x) => x.stage === 'announced' || x.data.awaiting);
    // validate every choice before changing anything so a failed accept never half-applies
    const resolved = [];
    for (const en of pending) {
      const choices = hook(en, 'choices')?.(en, ctx);
      let pick = picks[en.id];
      if (choices && !pick) {
        if (choices.some((c) => c.id === 'skip')) pick = 'skip';
        else if (choices.length === 1) pick = choices[0].id;
        else return { ok: false, error: 'Choose an option first' };
      }
      if (choices && !choices.some((c) => c.id === pick)) return { ok: false, error: 'That option is not available' };
      resolved.push([en, pick]);
    }
    for (const [en, pick] of resolved) {
      if (pick !== undefined && !hook(en, 'choose')?.(en, pick, ctx)) return { ok: false, error: 'That option is not available' };
    }
    for (const [en] of resolved) {
      if (en.stage === 'announced') advanceStage(en, 'active');
      if (en.data.payout) this.#payout(en);
      if (en.data.done) this.#cleanup(en);
    }
    const inter = this.s.entries.find((x) => x.kind === 'interlude' && x.stage === 'active');
    if (inter) {
      const puzzle = def(inter).createPuzzle(this.#ctx(), this.rng);
      if (puzzle) {
        this.puzzle = puzzle;
        this.s.puzzleEntry = inter.id;
        this.s.phase = 'event';
        return { ok: true, phase: 'event' };
      }
      this.#cleanup(inter); // the board could not support it after all: fall back to a plain round
    }
    this.beginRound();
    return { ok: true, phase: this.s.phase };
  }

  // ---- interludes and puzzle events ----
  get interlude() { return this.s.entries.find((x) => x.kind === 'interlude' && x.stage === 'active') || null; }

  /** Finishes the active interlude. `giveUp` abandons without reward; `stabilize` spends a Stabilizer for half reward. */
  completeEvent({ giveUp = false, stabilize = false } = {}) {
    const en = this.interlude;
    if (this.s.phase !== 'event' || !en || !this.puzzle) return { ok: false, error: 'No event is active' };
    const d = def(en);
    const ctx = this.#ctx();
    let reward = { coins: 0, score: 0, label: 'Abandoned' };
    let stabilized = false;
    if (!giveUp) {
      if (stabilize) {
        if (!d.stabilizable || this.economy.held('stabilizer') < 1) return { ok: false, error: 'No Stabilizer available here' };
        this.economy.consume('stabilizer');
        this.puzzle.stabilize();
        stabilized = true;
      } else if (d.id !== 'letter_storm' && d.id !== 'chain_reaction' && !this.puzzle.isSolved(this.dictionary)) return { ok: false, error: 'Not solved yet' };
      if (d.id === 'chain_reaction') this.puzzle.collect();
      reward = d.resolve(this.puzzle, ctx);
      if (stabilized) reward = { ...reward, coins: Math.floor(reward.coins / 2), score: Math.floor(reward.score / 2), label: 'Stabilized' };
    }
    advanceStage(en, 'resolved');
    const key = `ev:${this.engine.solved}:${en.id}`;
    let coins = 0;
    if (!this.s.paid.includes(key)) {
      this.s.paid.push(key);
      coins = this.economy.award(`${key}:coins`, reward.coins);
      this.engine.score += reward.score || 0;
      this.s.stats.bonusScore += reward.score || 0;
      if (reward.reveal) this.economy.grantCredit('freeReveal', reward.reveal);
      if (reward.consequence) {
        const fx = this.consequences.add({ id: `${key}:fx`, source: en.id, round: this.engine.solved + 1, ...reward.consequence });
        if (fx) reward = { ...reward, effect: fx.label };
      }
      for (const k of reward.claim || []) if (!this.s.claimed.includes(k)) this.s.claimed.push(k);
    }
    advanceStage(en, 'rewarded');
    advanceStage(en, 'cleaned');
    this.s.stats.events[en.id] = (this.s.stats.events[en.id] || 0) + 1;
    this.s.entries = this.s.entries.filter((x) => x !== en);
    this.puzzle = null;
    this.s.puzzleEntry = null;
    this.beginRound();
    return { ok: true, reward: { ...reward, coins }, phase: this.s.phase };
  }

  /** Buys/uses the missing letter in a Letter Collapse puzzle (Wildcard Tile first, otherwise 2 coins). */
  fillMissing() {
    const p = this.puzzle;
    if (this.s.phase !== 'event' || !p || !['collapse', 'forge'].includes(p.type) || (p.type === 'collapse' && p.missing === null) || (p.type === 'forge' && p.variant !== 'missing') || p.filled) return { ok: false, error: 'No missing letter to supply' };
    const useTile = this.economy.held('wildcardTile') > 0;
    if (!useTile && this.economy.coins < 2) return { ok: false, error: 'Not enough coins' };
    if (!p.fillMissing()) return { ok: false, error: 'No missing letter to supply' };
    if (useTile) this.economy.consume('wildcardTile');
    else { this.economy.lose(2); this.economy.s.spent += 2; }
    return { ok: true, usedTile: useTile };
  }

  /** Reverse Wordle deduction attempt (the puzzle replaces guessing for this word). */
  submitReverse(word) {
    const p = this.puzzle;
    if (this.s.phase !== 'event' || !p || p.type !== 'reverse') return { ok: false, error: 'No deduction in progress' };
    const r = p.submit(String(word).toLowerCase(), this.dictionary);
    if (!r.ok) return r;
    if (r.correct) {
      this.puzzle = null;
      this.s.puzzleEntry = null;
      this.s.phase = 'guessing';
      const res = this.submit(this.engine.current.word);
      return { ...r, solved: true, res };
    }
    if (p.failed) {
      const rev = this.s.entries.find((x) => x.id === 'reverse_wordle');
      if (rev) this.#discard(rev);
      this.puzzle = null;
      this.s.puzzleEntry = null;
      this.beginRound();
      return { ...r, failed: true, answerHidden: true };
    }
    return r;
  }

  // ---- shop ----
  #unknownIndex() {
    const e = this.engine;
    const known = new Set(Object.keys(e.locked).map(Number));
    for (const g of e.guesses) g.result.forEach((r, i) => { if (r === CORRECT) known.add(i); });
    const unknown = [];
    for (let i = 0; i < e.current.word.length; i++) if (!known.has(i)) unknown.push(i);
    return e.current.word.length - Object.keys(e.locked).length >= 2 && unknown.length ? unknown : [];
  }

  /** Can this item be bought (or used from a credit) right now? Never mutates. */
  canBuy(item, { credit = false } = {}) {
    const d = ECONOMY.items[item];
    if (!d) return { ok: false, error: 'Unknown item', cost: 0 };
    const c = this.economy.check(item);
    const creditKind = item === 'reveal' ? 'freeReveal' : item === 'extraGuess' ? 'freeGuess' : null;
    const usingCredit = credit && creditKind && this.economy.held(creditKind) > 0;
    let result = usingCredit ? { ok: true, cost: 0 } : c;
    if (usingCredit && d.limitPerWord !== undefined && this.economy.s.used[item] >= d.limitPerWord) result = { ok: false, cost: 0, error: 'Limit reached for this word' };
    if (!result.ok) return result;
    if (this.s.phase === 'over' || this.s.phase === 'transition') return { ok: false, cost: result.cost, error: 'Shop is closed right now' };
    if (item === 'chaosCatalyst' || item === 'chaosBrake') {
      if (this.s.phase !== 'guessing') return { ok: false, cost: result.cost, error: 'Only available while guessing' };
      if (item === 'chaosCatalyst' && this.s.chaos.value >= Chaos.CHAOS.max) return { ok: false, cost: result.cost, error: 'Chaos Meter is already full' };
      if (item === 'chaosBrake' && this.s.chaos.value <= 0) return { ok: false, cost: result.cost, error: 'Chaos Meter is already empty' };
    }
    if (item === 'extraGuess' || item === 'reveal') {
      if (this.s.phase !== 'guessing') return { ok: false, cost: result.cost, error: 'Only available while guessing' };
      if (item === 'extraGuess' && this.engine.extra >= this.cfg.maxExtra) return { ok: false, cost: result.cost, error: 'No more extra guesses' };
      if (item === 'reveal' && (Object.keys(this.engine.hints).length >= this.cfg.maxHints || !this.#unknownIndex().length)) return { ok: false, cost: result.cost, error: 'No letter can be revealed' };
    }
    return { ...result, credit: usingCredit };
  }

  buy(item, opts = {}) {
    const c = this.canBuy(item, opts);
    if (!c.ok) return { ok: false, error: c.error };
    const e = this.engine;
    let out = {};
    if (item === 'chaosCatalyst') out = { chaos: Chaos.catalyst(this.s.chaos) };
    else if (item === 'chaosBrake') out = { chaos: Chaos.brake(this.s.chaos) };
    else if (item === 'extraGuess') { e.extra++; out = { attemptsLeft: e.attemptsLeft }; }
    else if (item === 'reveal') {
      const unknown = this.#unknownIndex();
      const index = unknown[this.rng.int(unknown.length)];
      e.hints[index] = e.current.word[index];
      out = { index, letter: e.hints[index] };
    }
    if (c.credit) {
      this.economy.takeCredit(item === 'reveal' ? 'freeReveal' : 'freeGuess');
      this.economy.s.used[item]++;
    } else if (!this.economy.commit(item)) return { ok: false, error: 'Purchase failed' };
    return { ok: true, item, ...out };
  }

  /** Arms a held Mistake Shield: the next unsuccessful guess does not use an attempt. */
  useShield() {
    if (this.s.phase !== 'guessing') return { ok: false, error: 'Only while guessing' };
    if (this.economy.s.shieldArmed) return { ok: false, error: 'Shield is already armed' };
    if (!this.economy.consume('shield')) return { ok: false, error: 'No Mistake Shield' };
    this.economy.s.shieldArmed = true;
    return { ok: true };
  }

  /** Swaps the announced modifier for a different eligible one (charged only on success). */
  useReroll() {
    if (this.s.phase !== 'announce') return { ok: false, error: 'Only while a rule is announced' };
    if (this.economy.held('reroll') < 1) return { ok: false, error: 'No Rule Reroll' };
    const target = this.s.entries.find((x) => x.stage === 'announced' && x.kind === 'modifier' && def(x).rerollable);
    if (!target) return { ok: false, error: 'This event cannot be rerolled' };
    const next = this.director.reroll(target, this.#ctx(), this.rng, this.s.director);
    if (!next) return { ok: false, error: 'No alternative rule is eligible' };
    advanceStage(next, 'announced');
    this.s.entries = this.s.entries.map((x) => (x === target ? next : x));
    this.s.director.cooldowns[next.id] = def(next).cooldown || 3;
    this.economy.consume('reroll');
    return { ok: true, id: next.id };
  }

  /** Word Infection: clear corruption with a Stabilizer (all cells) or 2 coins (one cell). */
  cleanse({ stabilizer = false } = {}) {
    const en = this.s.entries.find((x) => x.id === 'word_infection' && x.stage === 'active');
    if (!en || !en.data.cells.length || this.s.phase !== 'guessing') return { ok: false, error: 'Nothing to cleanse' };
    if (stabilizer) {
      if (!this.economy.consume('stabilizer')) return { ok: false, error: 'No Stabilizer' };
      const n = en.data.cells.length;
      en.data.cells = [];
      return { ok: true, cleared: n };
    }
    if (this.economy.coins < INFECTION.cleanseCost) return { ok: false, error: 'Not enough coins' };
    this.economy.lose(INFECTION.cleanseCost);
    this.economy.s.spent += INFECTION.cleanseCost;
    en.data.cells.shift();
    return { ok: true, cleared: 1 };
  }

  // ---- puzzle detours ----
  canDetour(id) {
    const d = MINIGAMES[id];
    if (!d) return { ok: false, error: 'Unknown challenge' };
    if (!['guessing', 'announce'].includes(this.s.phase)) return { ok: false, error: 'Finish the current event first' };
    if (this.s.detour || this.puzzle) return { ok: false, error: 'Another challenge is open' };
    const r = this.engine.solved + 1;
    const log = this.s.detours;
    if (log.count >= DETOUR_LIMITS.perRun) return { ok: false, error: 'You have used all detours this run' };
    if (log.lastRound === r) return { ok: false, error: 'One detour reward per round' };
    if (log.byId[id] !== undefined && r - log.byId[id] < DETOUR_LIMITS.cooldownRounds) return { ok: false, error: `Available again in ${DETOUR_LIMITS.cooldownRounds - (r - log.byId[id])} rounds` };
    return { ok: true, reward: d.reward(r) };
  }

  startDetour(id) {
    const c = this.canDetour(id);
    if (!c.ok) return c;
    const d = MINIGAMES[id];
    this.detourPuzzle = d.create({ rng: this.rng, round: this.engine.solved + 1, dictionary: this.dictionary });
    this.s.detour = { id, reward: c.reward, puzzle: this.detourPuzzle.toJSON() };
    return { ok: true, reward: c.reward };
  }

  /** Closes the open detour. Rewards are paid only for a solved puzzle, once. */
  finishDetour() {
    const dt = this.s.detour;
    if (!dt) return { ok: false, error: 'No challenge is open' };
    const p = this.detourPuzzle;
    const solved = !!p && p.isSolved();
    const round = this.engine.solved + 1;
    let reward = null;
    if (solved) {
      reward = dt.reward;
      if (reward.kind === 'coins') this.economy.award(`detour:${round}:${dt.id}`, reward.amount, { doubling: false });
      else if (reward.kind === 'reveal') this.economy.grantCredit('freeReveal', reward.amount);
      else if (reward.kind === 'guess') this.economy.grantCredit('freeGuess', reward.amount);
      this.s.detours.count++;
      this.s.detours.lastRound = round;
      this.s.detours.byId[dt.id] = round;
      this.s.stats.detours++;
    }
    this.s.detour = null;
    this.detourPuzzle = null;
    return { ok: true, solved, reward };
  }

  // ---- views ----
  /** Overlay data for the board (display only; the real crossword is never modified). */
  mask() {
    const out = { hidden: [], infected: [] };
    if (!this.engine.current) return out;
    const rc = this.#rc();
    for (const en of this.#activeHooks()) {
      const m = hook(en, 'mask')?.(en, rc);
      if (m?.hidden) out.hidden.push(...m.hidden);
      if (m?.infected) out.infected.push(...m.infected);
    }
    return out;
  }

  /** Chips for the HUD. */
  /** Active carried-over effects for the HUD. */
  get effects() { return this.consequences.active.map((f) => ({ id: f.id, type: f.type, icon: EFFECT_TYPES[f.type].icon, label: f.label, expiresRound: f.expiresRound })); }

  get chips() {
    return this.s.entries.filter((e) => e.stage === 'active' || e.stage === 'announced').map((en) => {
      const d = def(en);
      return { id: en.id, name: d.name, icon: d.icon, tier: d.tier, kind: en.kind, scope: d.scope ? d.scope(en) : null, progress: d.progress ? d.progress(en) : null, announced: en.stage === 'announced' };
    });
  }

  summary() {
    const base = this.engine.summary();
    return { ...base, coins: this.economy.coins, coinsEarned: this.economy.s.earned, events: { ...this.s.stats.events }, detours: this.s.stats.detours, bonusScore: this.s.stats.bonusScore };
  }

  toJSON() {
    const anarchy = {
      ...this.s,
      rng: this.rng.getState(),
      economy: this.economy.toJSON(),
      consequences: this.consequences.toJSON(),
      puzzle: this.puzzle ? this.puzzle.toJSON() : null,
      detour: this.s.detour ? { ...this.s.detour, puzzle: this.detourPuzzle.toJSON() } : null,
    };
    return { ...this.engine.toJSON(), anarchy };
  }
}
