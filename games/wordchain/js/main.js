import { loadDictionary } from './dictionaryService.js';
import { GameEngine } from './gameEngine.js';
import { Renderer } from './renderer.js';
import { GuessBuffer, bindInput } from './input.js';
import { saveGame, loadGame, clearGame, getBest, recordRun } from './storage.js';
import { validateSave } from './saveValidator.js';
import { buildCrosswordSvg, buildShareText, shareResult, downloadSvg } from './share.js';

const $ = (id) => document.getElementById(id);
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion() ? 0 : ms));

const renderer = new Renderer({
  board: $('board'), world: $('world'), guesses: $('guesses'), keyboard: $('keyboard'), toast: $('toast'),
  wordNum: $('word-num'), score: $('score'), attempts: $('attempts'), best: $('best'),
});
const buffer = new GuessBuffer();
let dictionary;
let engine;
let busy = false;
let runToken = 0; // bumped on restart/resume so stale async transitions abort
let lastResult = null;

const announce = (msg) => { $('status').textContent = msg; };

const persist = () => saveGame({ ...engine.toJSON(), draft: buffer.letters });

function refresh({ animate = false, holdKeys = false } = {}) {
  renderer.renderGuesses(engine, buffer, { holdKeys });
  renderer.renderBoard(engine, buffer, { animate });
  renderer.renderStats(engine, getBest().score);
}

function startRound() {
  buffer.reset(engine.locked);
  refresh({ animate: true });
  renderer.focusActive(engine);
  const cur = engine.current;
  if (cur) announce(`Word ${engine.wordNumber}, ${cur.dir}. ${Object.keys(engine.locked).length} letters are locked.`);
  setTimeout(() => engine.precompute(), 50); // precompute next placements while the player solves
}

function newGame() {
  runToken++;
  clearGame();
  engine = new GameEngine({ dictionary, seed: (Math.random() * 2 ** 32) >>> 0 });
  busy = false;
  closeModals();
  startRound();
  renderer.focusActive(engine, { instant: true });
  persist();
}

function resume(state) {
  runToken++;
  busy = false;
  engine = new GameEngine({ dictionary, state });
  if (engine.status === 'complete') { endRun(true); return; }
  buffer.reset(engine.locked);
  buffer.restoreDraft(state.draft);
  refresh();
  renderer.focusActive(engine, { instant: true });
  setTimeout(() => engine.precompute(), 50);
}

function closeModals() {
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
}

function endRun(complete) {
  clearGame();
  const isBest = recordRun({ score: engine.score, words: engine.solved });
  const best = getBest();
  lastResult = { words: engine.solved, score: engine.score, best: best.score, isBest, board: engine.board.words.map((w) => ({ ...w })) };
  $('share-status').textContent = '';
  $('share').disabled = $('download-svg').disabled = !lastResult.board.length;
  $('end-title').textContent = complete ? 'Crossword complete!' : 'Run over';
  $('end-message').textContent = complete
    ? 'No more words fit on your crossword. Amazing run!'
    : `The word was ${engine.current.word.toUpperCase()}.`;
  $('end-words').textContent = engine.solved;
  $('end-score').textContent = engine.score;
  $('end-best').textContent = best.score + (isBest ? ' (new!)' : '');
  $('end-modal').showModal();
  $('end-restart').focus();
  refresh();
}

async function submit() {
  if (busy || engine.status !== 'playing' || engine.phase !== 'guessing') return;
  const row = engine.guesses.length;
  if (!buffer.complete) { renderer.shakeRow(row); renderer.toast('Not enough letters'); return; }
  const res = engine.submitGuess(buffer.word);
  if (!res.ok) { renderer.shakeRow(row); renderer.toast(res.error); announce(res.error); return; }
  busy = true;
  const token = runToken;
  const alive = () => token === runToken;
  persist(); // never lose the guess, even if the page is closed mid-animation
  renderer.renderGuesses(engine, buffer, { holdKeys: true });
  renderer.flipRow(row);
  renderer.renderStats(engine, getBest().score);
  await wait(900);
  if (!alive()) return;
  if (res.solved) {
    renderer.toast('Solved!');
    refresh({ animate: true });
    await wait(450);
    if (!alive()) return;
    const solvedWord = engine.board.words[engine.board.words.length - 1];
    renderer.focusAll(engine); // zoom out to show the growing crossword
    renderer.highlightWord(engine, solvedWord);
    await wait(650);
    if (!alive()) return;
    engine.advance();
    if (engine.status === 'complete') { endRun(true); busy = false; return; }
    startRound();
    persist();
  } else if (res.lost) {
    endRun(false);
  } else {
    buffer.reset(engine.locked);
    persist();
    refresh();
    announce(`${engine.attemptsLeft} attempts left`);
  }
  busy = false;
}

bindInput({
  keyboardEl: $('keyboard'),
  isBlocked: () => busy || engine?.status !== 'playing' || engine?.phase !== 'guessing' || document.querySelector('dialog[open]') !== null,
  onLetter: (l) => { if (buffer.add(l)) { refresh(); persist(); } },
  onBackspace: () => { if (buffer.backspace()) { refresh(); persist(); } },
  onEnter: submit,
});

$('restart').addEventListener('click', newGame);
$('end-restart').addEventListener('click', newGame);
$('share').addEventListener('click', async () => {
  if (!lastResult) return;
  const svg = buildCrosswordSvg(lastResult.board);
  const text = buildShareText({ ...lastResult, url: location.href.split('#')[0] });
  const how = await shareResult({ svg, text });
  $('share-status').textContent = { shared: 'Shared!', copied: 'Result copied to clipboard.', downloaded: 'Crossword image downloaded.', cancelled: '' }[how];
});
$('download-svg').addEventListener('click', () => { if (lastResult) downloadSvg(buildCrosswordSvg(lastResult.board)); });
$('help').addEventListener('click', () => $('help-modal').showModal());
$('help-close').addEventListener('click', () => $('help-modal').close());
$('zoom-in').addEventListener('click', () => renderer.zoomBy(1.25));
$('zoom-out').addEventListener('click', () => renderer.zoomBy(0.8));
$('recenter').addEventListener('click', () => renderer.focusActive(engine));
addEventListener('resize', () => renderer.focusActive(engine, { instant: true }));

(async function init() {
  try {
    dictionary = await loadDictionary();
  } catch (e) {
    $('status').textContent = 'Could not load the word list. Serve this folder over HTTP and reload.';
    $('loading').textContent = 'Failed to load word list.';
    return;
  }
  $('loading').hidden = true;
  const saved = validateSave(loadGame(), dictionary);
  if (saved && saved.status === 'playing') {
    try { resume(saved); } catch { clearGame(); newGame(); }
  } else newGame();
  if (!localStorage.getItem('wordchain.seenHelp')) {
    try { localStorage.setItem('wordchain.seenHelp', '1'); } catch { /* ignore */ }
    $('help-modal').showModal();
  }
})();
