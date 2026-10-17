import { el, button, reduceMotion } from './dom.js';
import { STORM } from '../puzzles/letterStorm.js';
import { layoutFor } from '../puzzles/sliding.js';

/**
 * DOM views for the temporary puzzles. Each view receives the puzzle model and draws/updates itself;
 * every mutation goes through the model and then `ctx.changed()` (persist + refresh controls).
 * Views never touch the real crossword. ctx: { changed, game?, pulse?, board? }
 */
const VIEWS = {};
const timers = new Set();
const after = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };

export function mountPuzzleView(puzzle, host, ctx) {
  unmountPuzzleViews();
  host.replaceChildren();
  const view = VIEWS[puzzle.type];
  if (!view) { host.append(el('p', '', 'This challenge is unavailable.')); return; }
  view(puzzle, host, ctx);
}

export function unmountPuzzleViews() {
  for (const t of timers) clearTimeout(t);
  timers.clear();
}

/** Tap-to-swap tray: tap/Enter a tile, then another to swap. Arrow keys move focus; mouse users can also drag. */
function swapTray(host, { tiles, swap, label, fall = false, cls = '', spareFrom = Infinity }) {
  const tray = el('div', `tray ${cls}`, '', { role: 'group', 'aria-label': label });
  let selected = null;
  let dragFrom = null;
  const draw = () => {
    const focus = document.activeElement?.dataset?.i;
    tray.replaceChildren();
    tiles().forEach((l, i) => {
      const b = el('button', 'tray-tile' + (selected === i ? ' selected' : '') + (l ? '' : ' blank') + (i >= spareFrom ? ' spare' : '') + (fall && !reduceMotion() ? ' fall' : ''), l ? l.toUpperCase() : '＋', { type: 'button', 'data-i': String(i), draggable: l ? 'true' : 'false', 'aria-label': l ? `${i >= spareFrom ? 'Spare tile' : 'Tile'} ${l}, ${i >= spareFrom ? `spare ${i - spareFrom + 1}` : `position ${i + 1}`}${selected === i ? ', selected' : ''}` : `Empty slot ${i + 1}` });
      b.style.setProperty('--i', i);
      b.addEventListener('click', () => {
        if (!l) return;
        if (selected === null) selected = i;
        else if (selected === i) selected = null;
        else { const from = selected; selected = null; if (swap(from, i)) { fall = false; } }
        draw();
        tray.querySelector(`[data-i="${i}"]`)?.focus();
      });
      b.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        tray.querySelector(`[data-i="${i + d}"]`)?.focus();
      });
      b.addEventListener('dragstart', (e) => { dragFrom = i; e.dataTransfer?.setData('text/plain', String(i)); });
      b.addEventListener('dragover', (e) => e.preventDefault());
      b.addEventListener('drop', (e) => { e.preventDefault(); if (dragFrom !== null && dragFrom !== i && tiles()[i] && swap(dragFrom, i)) { selected = null; draw(); } dragFrom = null; });
      tray.append(b);
    });
    if (focus !== undefined) tray.querySelector(`[data-i="${focus}"]`)?.focus();
  };
  draw();
  host.append(tray);
  return { redraw: draw };
}

VIEWS.collapse = (p, host, ctx) => {
  host.append(el('p', 'hint', 'Your word crumbled. Rearrange the tiles into any valid word. Tap two tiles to swap them (or drag, or use ← → and Enter).'));
  const status = el('p', 'puzzle-status', '', { role: 'status', 'aria-live': 'polite' });
  const extra = el('div', 'puzzle-extra');
  const tray = swapTray(host, {
    tiles: () => p.slots, label: 'Letter tray', fall: true,
    swap: (i, j) => { const ok = p.swap(i, j); if (ok) { update(); ctx.changed(); } return ok; },
  });
  host.append(status, extra);
  function update() {
    status.textContent = p.hasBlank ? 'One tile is missing.' : p.isSolved(ctx.game.dictionary) ? `✔ ${p.arrangement.toUpperCase()} is a valid word` : p.arrangement.toUpperCase();
    status.classList.toggle('ok', !p.hasBlank && p.isSolved(ctx.game.dictionary));
    extra.replaceChildren();
    if (p.hasBlank) {
      const tile = ctx.game.economy.held('wildcardTile') > 0;
      extra.append(button(tile ? '🔤 Use Wildcard Tile' : '🔤 Buy missing letter (2🪙)', () => {
        const r = ctx.game.fillMissing();
        if (!r.ok) ctx.toast(r.error);
        tray.redraw(); update(); ctx.changed();
      }, 'secondary'));
    }
  }
  update();
};

VIEWS.forge = (p, host, ctx) => {
  const how = { anagram: 'Rearrange the same letters into a different valid word.', swap: 'Swap one tile with a spare tile (the two tiles after the gap) to make a different valid word.', missing: 'A tile is missing. Supply it (Wildcard Tile or 2 coins), then build a different valid word.' };
  host.append(el('p', 'objective-line', `Goal: ${how[p.variant]}`), el('p', 'hint', `Your word melted into the forge. Any valid word except ${p.word.toUpperCase()} works; there are at least ${p.choices} intended answer${p.choices > 1 ? 's' : ''}. Tap two tiles to swap them (or drag, or use ← → and Enter).`));
  const status = el('p', 'puzzle-status', '', { role: 'status', 'aria-live': 'polite' });
  const extra = el('div', 'puzzle-extra');
  const n = p.length;
  const tray = swapTray(host, {
    tiles: () => [...p.slots, ...p.spares], label: 'Forge tray', fall: true, spareFrom: p.spares.length ? n : Infinity,
    swap: (i, j) => {
      const [a, b] = i < j ? [i, j] : [j, i];
      const ok = b < n ? p.swap(a, b) : a < n ? p.exchange(a, b - n) : false;
      if (ok) { update(); ctx.changed(); }
      return ok;
    },
  });
  host.append(status, extra);
  function update() {
    const solved = p.isSolved(ctx.game.dictionary);
    status.textContent = p.hasBlank ? 'One tile is missing.' : solved ? `✔ ${p.arrangement.toUpperCase()} forged!` : p.arrangement === p.word ? `${p.arrangement.toUpperCase()} is the original word. Make a different one.` : p.arrangement.toUpperCase();
    status.classList.toggle('ok', solved);
    extra.replaceChildren();
    if (p.hasBlank) {
      const tile = ctx.game.economy.held('wildcardTile') > 0;
      extra.append(button(tile ? '🔤 Use Wildcard Tile' : '🔤 Buy missing tile (2🪙)', () => {
        const r = ctx.game.fillMissing();
        if (!r.ok) ctx.toast(r.error);
        tray.redraw(); update(); ctx.changed();
      }, 'secondary'));
    }
  }
  update();
};

VIEWS.repair = (p, host, ctx) => {
  host.append(el('p', 'hint', 'Tiles of a solved word were knocked loose. Swap them back so the word reads correctly again.'));
  const board = ctx.game.engine.board;
  const parent = board.words.find((w) => {
    const dx = w.dir === 'across' ? 1 : 0;
    return p.cells.every((c) => (dx ? c.y === w.y && c.x >= w.x && c.x < w.x + w.word.length : c.x === w.x && c.y >= w.y && c.y < w.y + w.word.length));
  });
  const row = el('div', 'repair-row', '', { 'aria-label': 'Word being repaired' });
  const trayHost = el('div');
  const status = el('p', 'puzzle-status', '', { role: 'status', 'aria-live': 'polite' });
  host.append(row, trayHost, status);
  const draw = () => {
    row.replaceChildren();
    const set = new Set(p.cells.map((c) => `${c.x},${c.y}`));
    if (parent) {
      const dx = parent.dir === 'across' ? 1 : 0;
      let k = 0;
      [...parent.word].forEach((_, i) => {
        const key = `${parent.x + (dx ? i : 0)},${parent.y + (dx ? 0 : i)}`;
        const free = set.has(key);
        const t = el('span', 'slot-tile' + (free ? ' loose' : ''), free ? (p.letters[k++] || '').toUpperCase() : parent.word[i].toUpperCase());
        row.append(t);
      });
    }
    status.textContent = p.isSolved() ? '✔ Repaired' : `${p.moves} swap${p.moves === 1 ? '' : 's'}`;
    status.classList.toggle('ok', p.isSolved());
  };
  draw();
  swapTray(trayHost, { tiles: () => p.letters, label: 'Loose tiles', swap: (i, j) => { const ok = p.swap(i, j); if (ok) { draw(); ctx.changed(); } return ok; } });
};

VIEWS.gravity = (p, host, ctx) => {
  host.append(el('p', 'hint', `Gravity shifted! Tilt the board so the tiles settle into ${p.word.length} letters along the bottom row, spelling the word you just solved.`));
  const grid = el('div', 'gravity-grid', '', { role: 'img' });
  grid.style.setProperty('--cols', p.word.length);
  const status = el('p', 'puzzle-status', '', { role: 'status', 'aria-live': 'polite' });
  const pad = el('div', 'tilt-pad');
  const draw = () => {
    grid.replaceChildren();
    grid.setAttribute('aria-label', `Event board: ${p.grid.join(' / ').replace(/\./g, '_')}`);
    for (const r of p.grid) for (const c of r) grid.append(el('span', 'g-cell' + (c === '.' ? ' empty' : ''), c === '.' ? '' : c.toUpperCase()));
    status.textContent = p.isSolved() ? `✔ ${p.word.toUpperCase()}` : `${p.moves} tilt${p.moves === 1 ? '' : 's'}`;
    status.classList.toggle('ok', p.isSolved());
  };
  const tilt = (d) => { if (p.isSolved()) return; if (p.tilt(d)) { draw(); ctx.changed(); } };
  const dirs = [['up', '▲', 'Tilt up'], ['left', '◀', 'Tilt left'], ['down', '▼', 'Tilt down'], ['right', '▶', 'Tilt right']];
  for (const [d, glyph, label] of dirs) pad.append(button(glyph, () => tilt(d), 'tilt', { 'aria-label': label }));
  pad.append(button('Hint', () => { const h = p.hint(); ctx.toast(h ? `Try tilting ${h}` : 'Already solved'); }, 'secondary hint-btn'));
  host.addEventListener('keydown', (e) => {
    const d = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
    if (d) { e.preventDefault(); tilt(d); }
  });
  host.append(grid, pad, status);
  draw();
};

VIEWS.storm = (p, host, ctx) => {
  host.append(el('p', 'hint', `Catch the letters that appear in ${p.target.toUpperCase()}. Wrong catches cancel good ones. ${p.calm ? 'Calm mode: no timer, tap whenever you like, then press Finish.' : 'It only lasts a few seconds.'}`));
  const status = el('p', 'puzzle-status', '', { role: 'status', 'aria-live': 'polite' });
  const field = el('div', 'storm-field' + (p.calm ? ' calm' : ''));
  const done = () => { if (!p.finished) { p.finish(); ctx.changed(); } status.textContent = `Caught ${p.good} good, ${p.bad} wrong`; field.classList.add('over'); for (const b of field.querySelectorAll('button')) b.disabled = true; };
  const start = performance.now();
  const update = () => { status.textContent = `Good ${p.good} · Wrong ${p.bad}`; };
  for (const d of p.drops) {
    const b = el('button', 'drop' + (p.caught.includes(d.id) ? ' caught' : ''), d.letter.toUpperCase(), { type: 'button', 'aria-label': `Letter ${d.letter}` });
    b.style.setProperty('--col', d.col);
    b.style.setProperty('--cols', STORM.columns);
    if (!p.calm) {
      b.style.setProperty('--fall', `${STORM.fall}ms`);
      b.style.animationDelay = `${d.at}ms`;
      b.classList.add('falling');
      b.disabled = true;
      after(() => { if (!p.finished) b.disabled = false; }, d.at);
      after(() => { b.disabled = true; }, d.at + STORM.fall);
    }
    b.addEventListener('click', () => {
      const r = p.catchDrop(d.id, performance.now() - start);
      if (r.ok) { b.classList.add('caught', r.good ? 'good' : 'bad'); b.disabled = true; update(); ctx.changed(); }
    });
    field.append(b);
  }
  const finish = button('Finish', done, 'primary-btn');
  host.append(field, status, finish);
  if (!p.calm) after(done, STORM.duration + 300);
  if (p.finished) done();
  update();
};

VIEWS.chain = (p, host, ctx) => {
  host.append(el('p', 'hint', p.links.length ? 'Your new word sets off a chain through connected words. Each new intersection pays once.' : 'No new intersections were found this time.'));
  const list = el('ol', 'chain-list');
  p.steps.forEach((s, i) => list.append(el('li', '', `Link ${i + 1}: ${s.cells.length} intersection${s.cells.length === 1 ? '' : 's'}${s.words.length ? ` → ${s.words.map((w) => w.toUpperCase()).join(', ')}` : ''}`)));
  host.append(list, el('p', 'puzzle-status ok', `+${p.points} points · +${p.coins} coins`));
  ctx.pulse?.(p.steps.map((s) => s.cells));
};

VIEWS.reverse = (p, host, ctx) => {
  host.append(el('p', 'hint', `Reverse Wordle: these guesses were made against a hidden ${p.answer.length}-letter word. Deduce it! ${p.attempts} tries.`));
  const clues = el('div', 'clue-grid', '', { role: 'list', 'aria-label': 'Clues' });
  for (const c of p.clues) {
    const row = el('div', 'row', '', { role: 'listitem' });
    row.style.setProperty('--len', c.word.length);
    [...c.word].forEach((l, i) => row.append(el('span', `tile ${c.result[i]}`, l.toUpperCase(), { 'aria-label': `${l} ${c.result[i]}` })));
    clues.append(row);
  }
  const form = el('form', 'reverse-form');
  const input = el('input', 'reverse-input', '', { type: 'text', maxlength: String(p.answer.length), autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', 'aria-label': 'Your deduction', placeholder: 'Your answer' });
  const go = el('button', 'primary-btn', 'Submit', { type: 'submit' });
  const status = el('p', 'puzzle-status', `${p.attemptsLeft} tries left`, { role: 'status', 'aria-live': 'polite' });
  form.append(input, go);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const word = input.value.trim().toLowerCase();
    if (word.length !== p.answer.length) { status.textContent = `Enter a ${p.answer.length}-letter word`; return; }
    input.value = '';
    ctx.submitReverse(word, status);
  });
  host.append(clues, form, status);
  setTimeout(() => input.focus(), 0);
};

VIEWS.sudoku = (p, host, ctx) => {
  host.append(el('p', 'hint', 'Fill the grid so each row, column and 2×2 box contains 1–4 exactly once.'));
  const grid = el('div', 'sudoku-grid', '', { role: 'grid', 'aria-label': 'Mini Sudoku' });
  const pad = el('div', 'num-pad');
  const status = el('p', 'puzzle-status', '', { role: 'status', 'aria-live': 'polite' });
  let sel = p.cells.findIndex((v, i) => !p.givens[i]);
  const draw = () => {
    const bad = p.conflicts();
    grid.replaceChildren();
    p.cells.forEach((v, i) => {
      const b = el('button', 'su-cell' + (p.givens[i] ? ' given' : '') + (i === sel ? ' selected' : '') + (bad.has(i) ? ' bad' : '') + (Math.floor(i / 4) === 1 ? ' r1' : '') + (i % 4 === 1 ? ' c1' : ''), v ? String(v) : '', { type: 'button', role: 'gridcell', 'aria-label': `Row ${Math.floor(i / 4) + 1} column ${(i % 4) + 1}${v ? `, ${v}` : ', empty'}${p.givens[i] ? ', given' : ''}`, 'data-i': String(i) });
      b.dataset.box = String((Math.floor(i / 8) * 2) + Math.floor((i % 4) / 2));
      b.addEventListener('click', () => { sel = i; draw(); grid.querySelector(`[data-i="${i}"]`)?.focus(); });
      grid.append(b);
    });
    status.textContent = p.isSolved() ? '✔ Solved' : bad.size ? 'Some numbers conflict.' : '';
    status.classList.toggle('ok', p.isSolved());
  };
  const put = (v) => { if (sel >= 0 && p.set(sel, v)) { draw(); grid.querySelector(`[data-i="${sel}"]`)?.focus(); ctx.changed(); } };
  for (let v = 1; v <= 4; v++) pad.append(button(String(v), () => put(v), 'num', { 'aria-label': `Enter ${v}` }));
  pad.append(button('⌫', () => put(0), 'num', { 'aria-label': 'Clear cell' }));
  grid.addEventListener('keydown', (e) => {
    if (/^[0-4]$/.test(e.key)) { put(Number(e.key)); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') { put(0); return; }
    const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4 }[e.key];
    if (move) {
      e.preventDefault();
      const n = sel + move;
      if (n >= 0 && n < 16 && !((move === 1 && sel % 4 === 3) || (move === -1 && sel % 4 === 0))) { sel = n; draw(); grid.querySelector(`[data-i="${sel}"]`)?.focus(); }
    }
  });
  host.append(grid, pad, status);
  draw();
};

VIEWS.sliding = (p, host, ctx) => {
  host.append(el('p', 'hint', 'Slide tiles into the blank to spell the word, with the blank in the last cell.'));
  const { cols } = layoutFor(p.word.length);
  const grid = el('div', 'slide-grid', '', { role: 'grid', 'aria-label': 'Sliding letters' });
  grid.style.setProperty('--cols', cols);
  const status = el('p', 'puzzle-status', '', { role: 'status', 'aria-live': 'polite' });
  const draw = () => {
    const focus = document.activeElement?.dataset?.i;
    grid.replaceChildren();
    p.tiles.forEach((l, i) => {
      const b = el('button', 'slide-tile' + (l ? '' : ' blank'), l.toUpperCase(), { type: 'button', role: 'gridcell', 'data-i': String(i), 'aria-label': l ? `Tile ${l}` : 'Blank', disabled: l ? null : 'true' });
      if (!l) b.setAttribute('aria-disabled', 'true');
      b.addEventListener('click', () => { if (p.move(i)) { draw(); ctx.changed(); } });
      grid.append(b);
    });
    if (focus !== undefined) grid.querySelector(`[data-i="${focus}"]`)?.focus();
    status.textContent = p.isSolved() ? `✔ ${p.word.toUpperCase()}` : `${p.moves} move${p.moves === 1 ? '' : 's'}`;
    status.classList.toggle('ok', p.isSolved());
  };
  grid.addEventListener('keydown', (e) => {
    const blank = p.tiles.indexOf('');
    const delta = { ArrowLeft: 1, ArrowRight: -1, ArrowUp: cols, ArrowDown: -cols }[e.key]; // arrows push the tile toward the blank
    if (delta) { e.preventDefault(); if (p.move(blank + delta)) { draw(); ctx.changed(); } }
  });
  host.append(grid, status);
  draw();
};

VIEWS.memory = (p, host, ctx) => {
  host.append(el('p', 'hint', 'Memorize the letters in order. They will be hidden, then rebuild the sequence. Three wrong taps ends the attempt.'));
  const seq = el('div', 'mem-seq', '', { 'aria-live': 'polite' });
  const bank = el('div', 'mem-bank', '', { role: 'group', 'aria-label': 'Letters' });
  const status = el('p', 'puzzle-status', '', { role: 'status', 'aria-live': 'polite' });
  const ready = button('I’m ready', () => { p.hide(); draw(); ctx.changed(); }, 'primary-btn');
  const retry = button('Try again', () => { p.input = []; p.mistakes = 0; p.revealed = true; draw(); ctx.changed(); }, 'secondary');
  const draw = () => {
    seq.replaceChildren();
    p.sequence.forEach((l, i) => {
      const shown = p.revealed || i < p.input.length;
      seq.append(el('span', 'slot-tile' + (shown ? '' : ' hidden'), shown ? l.toUpperCase() : '?'));
    });
    bank.replaceChildren();
    if (!p.revealed) for (const l of p.bank) bank.append(button(l.toUpperCase(), () => { const r = p.press(l); if (r.ok) { if (!r.correct) host.classList.add('wrong'); setTimeout(() => host.classList.remove('wrong'), 250); draw(); ctx.changed(); } }, 'mem-key', { disabled: p.isSolved() || p.failed ? 'true' : null }));
    ready.hidden = !p.revealed;
    retry.hidden = !p.failed;
    status.textContent = p.isSolved() ? '✔ Perfect recall' : p.failed ? 'Too many mistakes. Try again (no reward until solved).' : p.revealed ? 'Memorize…' : `Mistakes ${p.mistakes}/3`;
    status.classList.toggle('ok', p.isSolved());
  };
  host.append(seq, ready, bank, retry, status);
  draw();
};
