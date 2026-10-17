import { loadDictionary, loadLengths } from './dictionaryService.js';
import { GameEngine } from './gameEngine.js';
import { Renderer } from './renderer.js';
import { GuessBuffer, bindInput } from './input.js';
import { saveRun, loadRun, clearRun, getBestFor, recordRunFor, getMeta, setMeta } from './storage.js';
import { validateSave } from './saveValidator.js';
import { buildCrosswordSvg, buildShareText, buildShareGrid, shareResult, downloadSvg } from './share.js';
import { listModes, getMode, isModeId } from './gameModes.js';
import { createMenu, askConfirm } from './menu.js';
import { AnarchyGame } from './anarchy/anarchyGame.js';
import { createAnarchyUI } from './anarchy/ui/anarchyUI.js';
import { createAnarchyChrome } from './anarchy/ui/anarchyChrome.js';
import { EVENTS } from './anarchy/eventRegistry.js';

const $ = (id) => document.getElementById(id);
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion() ? 0 : ms));

const renderer = new Renderer({
  board: $('board'), world: $('world'), guesses: $('guesses'), keyboard: $('keyboard'), toast: $('toast'),
  wordNum: $('word-num'), score: $('score'), attempts: $('attempts'), best: $('best'),
  mode: $('mode-name'), tokensBox: $('tokens-box'), tokens: $('tokens'), objective: $('objective'),
  powerups: $('powerups'), hintBtn: $('hint'), extraBtn: $('extra-try'), breakdown: $('breakdown'), options: $('options'),
});
const buffer = new GuessBuffer();
let dictionary;
let engine = null;
let modeId = null; // mode of `engine`
let busy = false;
let menuOpen = true;
let selected = null; // previewed option id
let runToken = 0; // bumped on restart/resume/menu so stale async transitions abort
let lastResult = null;
let anarchy = null; // AnarchyGame wrapper when the Anarchy mode is active (engine === anarchy.engine)
const chrome = createAnarchyChrome();
const anUI = createAnarchyUI({
  hud: $('an-hud'), eventDialog: $('an-modal'), sideDialog: $('an-side'), renderer, getGame: () => anarchy,
  hooks: {
    persist: () => persist(), toast: (m) => renderer.toast(m), say: (m) => announce(m), refresh: () => { if (engine) refresh(); },
    startRound: () => startRound(), endRun: (complete) => endRun(complete),
    onReverseSolved: (res) => completeReverseWord(res),
    lockLetter: (i, l) => { buffer.lock(i, l); refresh(); },
    onPurchase: (id, cost) => chrome.metrics.purchase(id, cost), onShopOpen: () => chrome.metrics.shopOpened(),
  },
});

const announce = (msg) => { $('status').textContent = msg; };
const best = () => getBestFor(modeId).score;

const persist = () => { if (engine && modeId) saveRun(modeId, { ...(anarchy ? anarchy.toJSON() : engine.toJSON()), draft: buffer.letters }); };

function refresh({ animate = false, holdKeys = false } = {}) {
  renderer.renderGuesses(engine, buffer, { holdKeys });
  renderer.renderBoard(engine, buffer, { animate });
  renderer.renderStats(engine, best());
  renderer.renderPowerups(engine);
  const choosing = engine.phase === 'choosing' && engine.status === 'playing';
  $('choice').hidden = !choosing;
  $('play-area').hidden = choosing;
  $('panel').classList.toggle('choosing', choosing);
  $('an-hud').hidden = !anarchy;
  $('app').classList.toggle('anarchy', !!anarchy);
  if (anarchy) { chrome.sync(anarchy); anUI.renderHud(); applyMask(); } else chrome.leave();
}

/** Display-only overlays from Anarchy modifiers (Blackout, Infection). The real crossword is never changed. */
function applyMask() {
  for (const el of renderer.cellEls.values()) { el.classList.remove('masked', 'infected'); el.removeAttribute('aria-hidden'); }
  const m = anarchy.mask();
  for (const k of m.hidden) { const el = renderer.cellEls.get(k); if (el) { el.classList.add('masked'); el.setAttribute('aria-hidden', 'true'); } }
  for (const k of m.infected) renderer.cellEls.get(k)?.classList.add('infected');
}

function startRound() {
  buffer.reset(engine.locked, engine.wordLength);
  renderer.clearGhosts();
  refresh({ animate: true });
  renderer.focusActive(engine);
  const cur = engine.current;
  if (cur) announce(`Word ${engine.wordNumber}, ${cur.word.length} letters, ${cur.dir}. ${Object.keys(engine.locked).length} letters are locked.`);
  setTimeout(() => engine.precompute(), 50); // Classic: precompute next placements while the player solves
}

/** Selection modes: show the offered placements on the board and as cards. */
function showChoice({ instant = false } = {}) {
  const opts = engine.publicOptions;
  refresh();
  drawChoice();
  renderer.focusOptions(engine, { instant });
  announce(opts.length === 1 ? 'One placement is available. Continue to play it.' : `Choose one of ${opts.length} placements. Highlighted footprints show where each word would go.`);
}

function drawChoice() {
  renderer.renderChoice(engine, { choose, reroll, preview }, { selected });
}

function preview(id) {
  if (selected === id) return;
  selected = id;
  drawChoice();
}

async function choose(id) {
  if (busy || menuOpen || engine.phase !== 'choosing') return;
  const res = engine.choose(id);
  if (!res.ok) {
    renderer.toast(res.error);
    if (engine.status === 'complete') { endRun(true); return; }
    selected = null;
    showChoice();
    persist();
    return;
  }
  selected = null;
  renderer.renderBreakdown(null, engine.mode);
  startRound();
  persist();
}

function reroll(id) {
  if (busy || menuOpen) return;
  const res = engine.reroll(id);
  if (!res.ok) { renderer.toast(res.error); return; }
  selected = null;
  renderer.toast('Placement replaced');
  showChoice();
  persist();
}

function newGame(id = modeId) {
  runToken++;
  anUI.reset();
  modeId = id;
  clearRun(id);
  const seed = (Math.random() * 2 ** 32) >>> 0;
  if (getMode(id).features.anarchy) {
    anarchy = new AnarchyGame({ dictionary, seed, reduceMotion: reduceMotion() });
    anarchy.beginRound();
    engine = anarchy.engine;
    chrome.metrics.startRun();
  } else {
    anarchy = null;
    engine = new GameEngine({ dictionary, seed, mode: id });
  }
  busy = false;
  selected = null;
  closeModals();
  renderer.renderBreakdown(null, engine.mode);
  $('help-anarchy').hidden = !anarchy;
  startRound();
  renderer.focusActive(engine, { instant: true });
  persist();
}

function resume(id, state) {
  runToken++;
  modeId = id;
  busy = false;
  selected = null;
  anUI.reset();
  if (getMode(id).features.anarchy) {
    anarchy = new AnarchyGame({ dictionary, saved: state, reduceMotion: reduceMotion() });
    engine = anarchy.engine;
  } else {
    anarchy = null;
    engine = new GameEngine({ dictionary, state });
  }
  $('help-anarchy').hidden = !anarchy;
  renderer.renderBreakdown(null, engine.mode);
  if (engine.status === 'complete') { endRun(true); return; }
  if (anarchy && (anarchy.phase !== 'guessing' || anarchy.detour)) {
    buffer.reset(engine.locked, engine.wordLength);
    refresh();
    renderer.focusActive(engine, { instant: true });
    anUI.step(); // re-opens the pending event card, puzzle or detour
    return;
  }
  if (engine.phase === 'choosing') { showChoice({ instant: true }); persist(); return; }
  buffer.reset(engine.locked, engine.wordLength);
  buffer.restoreDraft(state.draft);
  refresh();
  renderer.focusActive(engine, { instant: true });
  setTimeout(() => engine.precompute(), 50);
}

function closeModals() {
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
}

function recordAnarchyWord(res) {
  if (!anarchy.claimCompletion()) return false;
  persist();
  chrome.audio.bump(engine.solved);
  chrome.metrics.word({ attempts: engine.history[engine.history.length - 1]?.attempts ?? engine.guesses.length, coins: res.rewards?.coins || 0 });
  for (const en of anarchy.entries.filter((x) => x.stage === 'announced')) {
    const def = EVENTS[en.id];
    chrome.metrics.event(en.id, def.tier !== 'minor');
    chrome.audio.accent({ jackpot: 'jackpot', wordquake: 'quake', gravity_shift: 'quake', letter_storm: 'storm', chain_reaction: 'chain', boss_word: 'boss' }[en.id]);
  }
  chrome.sync(anarchy);
  return true;
}

function finishAnarchyCompletion(res) {
  if (!anarchy || anarchy.phase !== 'transition' || !res?.solved) return false;
  anUI.resultFx(res);
  anarchy.proceed();
  recordAnarchyWord(res);
  persist();
  busy = false;
  anUI.step();
  return true;
}

async function completeReverseWord(res) {
  if (busy || !anarchy || !res?.solved) return;
  busy = true;
  const token = runToken;
  const alive = () => token === runToken;
  renderer.renderBreakdown(res.breakdown, engine.mode);
  refresh({ animate: true });
  await wait(450);
  if (!alive()) return;
  const solvedWord = engine.board.words[engine.board.words.length - 1];
  renderer.focusAll(engine);
  renderer.highlightWord(engine, solvedWord);
  await wait(650);
  if (!alive()) return;
  finishAnarchyCompletion(res);
}

function endRun(complete) {
  if (anarchy) { if (!complete) chrome.metrics.failed(); chrome.metrics.endRun(); chrome.audio.accent(complete ? 'win' : 'fail'); }
  clearRun(modeId);
  const sum = anarchy ? anarchy.summary() : engine.summary();
  const isBest = recordRunFor(modeId, { score: engine.score, words: engine.solved });
  const bestNow = getBestFor(modeId);
  lastResult = { ...sum, best: bestNow.score, isBest, board: engine.board.words.map((w) => ({ ...w })) };
  $('share-status').textContent = '';
  $('share').disabled = $('download-svg').disabled = !lastResult.board.length;
  $('end-title').textContent = complete ? 'Crossword complete!' : 'Run over';
  $('end-message').textContent = complete
    ? 'No more words fit on your crossword. Amazing run!'
    : `The word was ${engine.current.word.toUpperCase()}.`;
  $('end-mode').textContent = `${engine.mode.icon} ${engine.mode.name}`;
  $('end-words').textContent = sum.words;
  $('end-score').textContent = sum.score;
  $('end-best').textContent = bestNow.score + (isBest ? ' (new!)' : '');
  $('end-avg').textContent = sum.avgGuesses || '–';
  $('end-cross').textContent = sum.intersections;
  $('end-junc').textContent = sum.junctions;
  $('end-obj-box').hidden = sum.objectives === null;
  $('end-obj').textContent = sum.objectives ?? 0;
  $('end-coins-box').hidden = $('end-events-box').hidden = !anarchy;
  if (anarchy) {
    $('end-coins').textContent = sum.coinsEarned;
    $('end-events').textContent = Object.values(sum.events).reduce((a, b) => a + b, 0) + sum.detours;
    lastResult.extra = `${sum.coinsEarned} coins earned · ${Object.values(sum.events).reduce((a, b) => a + b, 0)} events survived`;
  }
  $('end-board').innerHTML = lastResult.board.length ? buildCrosswordSvg(lastResult.board, { title: `WordChain ${engine.mode.name}` }) : '';
  renderer.clearGhosts();
  refresh();
  $('end-modal').showModal();
  $('end-restart').focus();
}

async function submit() {
  if (busy || menuOpen || engine.status !== 'playing' || engine.phase !== 'guessing' || (anarchy && anarchy.phase !== 'guessing')) return;
  const row = engine.guesses.length;
  if (!buffer.complete) { renderer.shakeRow(row); renderer.toast('Not enough letters'); return; }
  const res = anarchy ? anarchy.submit(buffer.word) : engine.submitGuess(buffer.word);
  if (!res.ok) { renderer.shakeRow(row); renderer.toast(res.error); announce(res.error); return; }
  busy = true;
  const token = runToken;
  const alive = () => token === runToken;
  persist(); // never lose the guess, even if the page is closed mid-animation
  if (anarchy) anUI.onGuess(res);
  renderer.renderGuesses(engine, buffer, { holdKeys: true });
  renderer.flipRow(row);
  renderer.renderStats(engine, best());
  await wait(900);
  if (!alive()) return;
  if (res.solved) {
    renderer.toast('Solved!');
    renderer.renderBreakdown(res.breakdown, engine.mode);
    if (res.breakdown.objective) renderer.toast(`Objective complete: +${res.breakdown.objective.score}`);
    refresh({ animate: true });
    await wait(450);
    if (!alive()) return;
    const solvedWord = engine.board.words[engine.board.words.length - 1];
    renderer.focusAll(engine); // zoom out to show the growing crossword
    renderer.highlightWord(engine, solvedWord);
    await wait(650);
    if (!alive()) return;
    if (anarchy) {
      finishAnarchyCompletion(res); // applies the planned next word and records every completion path once
      return;
    }
    engine.advance();
    if (engine.status === 'complete') { endRun(true); busy = false; return; }
    if (engine.phase === 'choosing') { selected = null; showChoice(); persist(); busy = false; return; }
    startRound();
    persist();
  } else if (res.lost) {
    endRun(false);
  } else {
    buffer.reset(engine.locked, engine.wordLength);
    persist();
    refresh();
    announce(`${engine.attemptsLeft} attempts left`);
  }
  busy = false;
}

function useHint() {
  if (busy || menuOpen) return;
  const res = engine.hint();
  if (!res.ok) { renderer.toast(res.error); return; }
  buffer.lock(res.index, res.letter);
  refresh();
  persist();
  renderer.toast(`Letter ${res.index + 1} is ${res.letter.toUpperCase()}`);
  announce(`Hint: letter ${res.index + 1} is ${res.letter}. It is locked.`);
}

function useExtraTry() {
  if (busy || menuOpen) return;
  const res = engine.extraTry();
  if (!res.ok) { renderer.toast(res.error); return; }
  refresh();
  persist();
  announce(`Extra try added. ${res.attemptsLeft} attempts left.`);
}

bindInput({
  keyboardEl: $('keyboard'),
  isBlocked: () => busy || menuOpen || engine?.status !== 'playing' || engine?.phase !== 'guessing' || (anarchy && anarchy.phase !== 'guessing') || document.querySelector('dialog[open]') !== null,
  onLetter: (l) => { if (buffer.add(l)) { renderer.renderBreakdown(null, engine.mode); refresh(); persist(); } },
  onBackspace: () => { if (buffer.backspace()) { refresh(); persist(); } },
  onEnter: submit,
});

// ---- menu and navigation ----
const menu = createMenu({
  root: $('menu'), modes: listModes(), confirmDialog: $('confirm-modal'), currentMode: () => modeId,
  getInfo: (id) => ({ best: getBestFor(id), saved: savedSummaryUnvalidated(id) }),
  onPlay: (id, { fresh }) => startMode(id, { fresh }),
});

// Menu cards only need a light check; the full validation happens when the save is loaded.
function savedSummaryUnvalidated(id) {
  const s = loadRun(id);
  if (!s || s.status !== 'playing' || !Number.isInteger(s.solved) || !Number.isInteger(s.score)) return null;
  return { words: s.solved, score: s.score };
}

function showMenu(note = '') {
  runToken++; // abort in-flight animations; state was persisted at every step
  busy = false;
  anUI.reset();
  if (engine && modeId && engine.status === 'playing') persist();
  chrome.leave(); // Anarchy theme and music never leak into the menu or other modes
  menuOpen = true;
  closeModals();
  $('menu-note').textContent = note;
  menu.render();
  $('menu').hidden = false;
  $('app').hidden = true;
  $('menu').scrollTop = 0;
  $('menu').querySelector('button')?.focus();
}

function showGame() {
  menuOpen = false;
  $('menu').hidden = true;
  $('app').hidden = false;
  setMeta({ lastMode: modeId });
}

async function startMode(id, { fresh }) {
  const mode = getMode(id);
  try {
    $('menu-note').textContent = mode.features.variableLength ? 'Loading word lists…' : '';
    await loadLengths(dictionary, mode.wordLengths);
  } catch {
    $('menu-note').textContent = 'Could not load the word lists for this mode.';
    return;
  }
  const saved = fresh ? null : validateSave(loadRun(id), dictionary, id);
  let note = '';
  showGame();
  if (saved && saved.status === 'playing') {
    try { resume(id, saved); } catch { newGame(id); note = 'Saved run could not be restored; started a new one.'; }
  } else {
    if (!fresh && loadRun(id)) note = 'Saved run was invalid; started a new one.';
    newGame(id);
  }
  $('help-mode').textContent = `${engine.mode.name}: ${engine.mode.description}`;
  if (note) renderer.toast(note);
  renderer.focusActive(engine, { instant: true });
  showFirstTimeHelp(id);
}

/** Contextual onboarding: the How to Play dialog opens once, at the first game start (never over the mode menu). */
function showFirstTimeHelp(id) {
  try {
    if (localStorage.getItem('wordchain.seenHelp')) return;
    localStorage.setItem('wordchain.seenHelp', '1');
  } catch { return; }
  if (id === 'anarchy') renderer.toast('Anarchy: solve words to fill the Chaos Meter, spend coins in the 🪙 Shop, and watch the rules change.');
  $('help-modal').showModal();
}

$('menu-btn').addEventListener('click', () => showMenu());
$('restart').addEventListener('click', async () => {
  if (busy || menuOpen) return;
  const ok = await askConfirm($('confirm-modal'), `Abandon this ${engine.mode.name} run and start a new one?`, { yes: 'Start new run', no: 'Keep playing' });
  if (ok) newGame(modeId);
});
$('end-restart').addEventListener('click', () => newGame(modeId));
$('end-menu').addEventListener('click', () => showMenu());
$('share').addEventListener('click', async () => {
  if (!lastResult) return;
  const svg = buildCrosswordSvg(lastResult.board);
  const text = buildShareText({ ...lastResult, mode: lastResult.modeName, grid: buildShareGrid(lastResult.board), url: location.href.split('#')[0] });
  const how = await shareResult({ svg, text });
  $('share-status').textContent = { shared: 'Shared!', copied: 'Result copied to clipboard.', downloaded: 'Crossword image downloaded.', cancelled: '' }[how];
});
$('download-svg').addEventListener('click', () => { if (lastResult) downloadSvg(buildCrosswordSvg(lastResult.board)); });
$('help').addEventListener('click', () => $('help-modal').showModal());
$('help-close').addEventListener('click', () => $('help-modal').close());
$('zoom-in').addEventListener('click', () => renderer.zoomBy(1.25));
$('zoom-out').addEventListener('click', () => renderer.zoomBy(0.8));
$('recenter').addEventListener('click', () => (engine?.phase === 'choosing' ? renderer.focusOptions(engine) : renderer.focusActive(engine)));
$('hint').addEventListener('click', useHint);
$('extra-try').addEventListener('click', useExtraTry);
addEventListener('resize', () => { if (engine && !menuOpen) (engine.phase === 'choosing' ? renderer.focusOptions(engine) : renderer.focusActive(engine, { instant: true })); });

// Tapping a highlighted footprint previews that option (choosing is confirmed with the card button).
renderer.onBoardTap(({ x, y }) => {
  if (menuOpen || engine?.phase !== 'choosing') return;
  const hit = engine.publicOptions.find((o) => {
    const [dx, dy] = o.dir === 'across' ? [1, 0] : [0, 1];
    return Array.from({ length: o.length }, (_, i) => [o.x + dx * i, o.y + dy * i]).some(([cx, cy]) => cx === x && cy === y);
  });
  if (hit) {
    preview(hit.id);
    $('options').querySelector(`[data-id="${CSS.escape(hit.id)}"]`)?.scrollIntoView({ block: 'nearest' });
  }
});

(async function init() {
  try {
    dictionary = await loadDictionary();
  } catch (e) {
    $('status').textContent = 'Could not load the word list. Serve this folder over HTTP and reload.';
    $('menu-note').textContent = 'Failed to load word list. Serve this folder over HTTP and reload.';
    $('loading').textContent = 'Failed to load word list.';
    return;
  }
  $('loading').hidden = true;
  const last = getMeta().lastMode;
  if (isModeId(last)) modeId = last; // highlighted in the menu
  menu.render();
  $('menu').querySelector('button')?.focus();
})();

// Offline support: the service worker is scoped to this folder only (see sw.js).
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => { /* optional: the game works without it */ }); });
}
