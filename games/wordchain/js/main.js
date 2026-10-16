import { loadDictionary } from './dictionaryService.js';
import { GameEngine } from './gameEngine.js';
import { Renderer } from './renderer.js';
import { GuessBuffer, bindInput } from './input.js';
import { saveGame, loadGame, clearGame, getBest, recordRun } from './storage.js';

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

const announce = (msg) => { $('status').textContent = msg; };

function refresh({ animate = false } = {}) {
  renderer.renderGuesses(engine, buffer);
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
  clearGame();
  engine = new GameEngine({ dictionary, seed: (Math.random() * 2 ** 32) >>> 0 });
  busy = false;
  closeModals();
  startRound();
  renderer.focusActive(engine, { instant: true });
  saveGame(engine.toJSON());
}

function resume(state) {
  engine = new GameEngine({ dictionary, state });
  buffer.reset(engine.locked);
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
  renderer.renderGuesses(engine, buffer);
  renderer.flipRow(row);
  renderer.renderStats(engine, getBest().score);
  await wait(900);
  saveGame(engine.toJSON());
  if (res.solved) {
    renderer.toast('Solved!');
    refresh();
    await wait(600);
    engine.advance();
    if (engine.status === 'complete') { endRun(true); busy = false; return; }
    startRound();
    saveGame(engine.toJSON());
  } else if (res.lost) {
    endRun(false);
  } else {
    buffer.reset(engine.locked);
    refresh();
    announce(`${engine.attemptsLeft} attempts left`);
  }
  busy = false;
}

bindInput({
  keyboardEl: $('keyboard'),
  isBlocked: () => busy || engine?.status !== 'playing' || engine?.phase !== 'guessing' || document.querySelector('dialog[open]') !== null,
  onLetter: (l) => { if (buffer.add(l)) { refresh(); } },
  onBackspace: () => { if (buffer.backspace()) refresh(); },
  onEnter: submit,
});

$('restart').addEventListener('click', () => { if (busy) return; newGame(); });
$('end-restart').addEventListener('click', newGame);
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
  const saved = loadGame();
  if (saved && saved.status === 'playing') resume(saved);
  else newGame();
  if (!localStorage.getItem('wordchain.seenHelp')) {
    try { localStorage.setItem('wordchain.seenHelp', '1'); } catch { /* ignore */ }
    $('help-modal').showModal();
  }
})();
