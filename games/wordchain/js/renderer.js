import { WORD_LENGTH, cellsOf, key } from './placementValidator.js';
import { MAX_ATTEMPTS } from './gameEngine.js';
import { letterStatuses } from './wordleEvaluator.js';

const CELL = 44; // px, board cell pitch at zoom 1
const ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['enter', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'backspace'],
];

export class Renderer {
  constructor(els) {
    this.el = els;
    this.view = { x: 0, y: 0, zoom: 1 };
    this.cellEls = new Map();
    this.#buildGuessGrid();
    this.#buildKeyboard();
    this.#bindPanZoom();
  }

  #buildGuessGrid() {
    const g = this.el.guesses;
    g.innerHTML = '';
    this.rows = [];
    for (let r = 0; r < MAX_ATTEMPTS; r++) {
      const row = document.createElement('div');
      row.className = 'row';
      row.setAttribute('role', 'row');
      const tiles = [];
      for (let c = 0; c < WORD_LENGTH; c++) {
        const t = document.createElement('div');
        t.className = 'tile';
        t.setAttribute('role', 'gridcell');
        row.append(t);
        tiles.push(t);
      }
      g.append(row);
      this.rows.push({ row, tiles });
    }
  }

  #buildKeyboard() {
    const k = this.el.keyboard;
    k.innerHTML = '';
    this.keys = {};
    for (const keysInRow of ROWS) {
      const row = document.createElement('div');
      row.className = 'kb-row';
      for (const part of keysInRow) {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.key = part;
        b.className = 'key' + (part.length > 1 ? ' wide' : '');
        b.textContent = part === 'enter' ? 'Enter' : part === 'backspace' ? '⌫' : part;
        b.setAttribute('aria-label', part === 'backspace' ? 'Backspace' : part === 'enter' ? 'Enter' : part);
        row.append(b);
        this.keys[part] = b;
      }
      k.append(row);
    }
  }

  /** Draw the guess panel from engine state plus the live buffer. */
  renderGuesses(engine, buffer, { holdKeys = false } = {}) {
    const locked = engine.locked;
    this.rows.forEach(({ row, tiles }, r) => {
      const guess = engine.guesses[r];
      const isCurrent = r === engine.guesses.length && engine.status === 'playing' && engine.phase === 'guessing';
      row.classList.toggle('current', isCurrent);
      tiles.forEach((t, c) => {
        t.className = 'tile';
        if (guess) {
          t.textContent = guess.word[c];
          t.classList.add('filled', guess.result[c]);
        } else if (isCurrent) {
          t.textContent = buffer.letters[c];
          if (buffer.letters[c]) t.classList.add('filled');
          if (c in locked) t.classList.add('locked');
        } else {
          t.textContent = '';
          if (c in locked && engine.status === 'playing') t.classList.add('locked-hint');
        }
      });
    });
    // while a row is flipping, keep keyboard colors from spoiling the reveal
    const st = letterStatuses(holdKeys ? engine.guesses.slice(0, -1) : engine.guesses);
    for (const [k, b] of Object.entries(this.keys)) {
      if (k.length === 1) b.className = 'key' + (st[k] ? ' ' + st[k] : '');
    }
  }

  shakeRow(r) {
    const row = this.rows[r]?.row;
    if (!row) return;
    row.classList.remove('shake');
    void row.offsetWidth;
    row.classList.add('shake');
  }

  flipRow(r) {
    const row = this.rows[r]?.row;
    row?.classList.add('reveal');
    setTimeout(() => row?.classList.remove('reveal'), 900);
  }

  renderStats(engine, best) {
    this.el.wordNum.textContent = engine.status === 'playing' ? engine.wordNumber : engine.solved;
    this.el.score.textContent = engine.score;
    this.el.attempts.textContent = engine.status === 'playing' ? Math.max(0, engine.attemptsLeft) : 0;
    this.el.best.textContent = Math.max(best, engine.score);
  }

  /** Rebuild the crossword board DOM incrementally; new cells animate in. */
  renderBoard(engine, buffer, { animate = false } = {}) {
    const board = engine.board;
    const frag = document.createDocumentFragment();
    const wanted = new Map();
    for (const w of board.words) {
      for (const c of cellsOf(w.word, w.x, w.y, w.dir)) wanted.set(key(c.x, c.y), { x: c.x, y: c.y, letter: c.letter, state: 'solved' });
    }
    const cur = engine.current && engine.status === 'playing' && engine.phase === 'guessing' ? engine.current : null;
    if (cur) {
      for (const c of cellsOf(cur.word, cur.x, cur.y, cur.dir)) {
        const k = key(c.x, c.y);
        if (wanted.has(k)) wanted.get(k).crossing = true;
        else wanted.set(k, { x: c.x, y: c.y, letter: buffer.letters[c.i] || '', state: 'active' });
      }
    }
    for (const [k, el] of this.cellEls) if (!wanted.has(k)) { el.remove(); this.cellEls.delete(k); }
    for (const [k, d] of wanted) {
      let el = this.cellEls.get(k);
      if (!el) {
        el = document.createElement('div');
        el.style.transform = `translate(${d.x * CELL}px, ${d.y * CELL}px)`;
        this.cellEls.set(k, el);
        frag.append(el);
        if (animate) el.dataset.fresh = '1';
      }
      el.className = 'cell ' + d.state + (d.crossing ? ' crossing' : '') + (el.dataset.fresh ? ' pop' : '');
      el.textContent = d.letter.toUpperCase();
      if (el.dataset.fresh) {
        delete el.dataset.fresh;
      }
    }
    this.el.world.append(frag);
    this.el.board.setAttribute('aria-label',
      `Crossword with ${board.words.length} solved words. Arrow keys pan, plus and minus zoom.`);
  }

  /** Briefly highlight a solved word and the cells where it crosses others. */
  highlightWord(engine, w) {
    if (!w) return;
    for (const c of cellsOf(w.word, w.x, w.y, w.dir)) {
      const el = this.cellEls.get(key(c.x, c.y));
      if (!el) continue;
      const crossing = engine.board.cells.get(key(c.x, c.y))?.dirs.size > 1;
      el.classList.remove('flash', 'flash-cross');
      void el.offsetWidth;
      el.classList.add(crossing ? 'flash-cross' : 'flash');
    }
  }

  /** Smoothly frame the whole crossword (zoom-out reveal). */
  focusAll(engine) {
    const cells = [];
    for (const w of engine.board.words) cells.push(...cellsOf(w.word, w.x, w.y, w.dir));
    if (!cells.length) return;
    this.#frame(cells, { maxZoom: 1.2, minZoom: 0.25, instant: false });
  }

  /** Center on the active word (or the whole board if it fits readably). */
  focusActive(engine, { instant = false } = {}) {
    const pts = [];
    const cur = engine.current;
    if (cur) pts.push(...cellsOf(cur.word, cur.x, cur.y, cur.dir));
    const all = [];
    for (const w of engine.board.words) all.push(...cellsOf(w.word, w.x, w.y, w.dir));
    const full = all.concat(pts);
    if (!full.length) return;
    const rect = this.el.board.getBoundingClientRect();
    const fit = this.#fit(full, rect);
    if (fit < 0.7 && pts.length) {
      // board too large to read: keep the active word fully in view instead
      const zoom = Math.min(1.1, Math.max(0.7, rect.width / ((WORD_LENGTH + 1) * CELL)));
      this.#frame(pts, { maxZoom: zoom, minZoom: zoom, instant });
    } else this.#frame(full, { maxZoom: 1.4, minZoom: 0.25, instant });
  }

  #bb(cells) {
    return {
      x0: Math.min(...cells.map((c) => c.x)), x1: Math.max(...cells.map((c) => c.x)) + 1,
      y0: Math.min(...cells.map((c) => c.y)), y1: Math.max(...cells.map((c) => c.y)) + 1,
    };
  }

  #fit(cells, rect) {
    const bb = this.#bb(cells);
    const pad = 1.5;
    return Math.min(rect.width / ((bb.x1 - bb.x0 + pad) * CELL), rect.height / ((bb.y1 - bb.y0 + pad) * CELL));
  }

  #frame(cells, { maxZoom, minZoom, instant }) {
    const rect = this.el.board.getBoundingClientRect();
    const bb = this.#bb(cells);
    const zoom = Math.max(minZoom, Math.min(maxZoom, this.#fit(cells, rect)));
    this.el.world.classList.toggle('instant', instant);
    this.view.zoom = zoom;
    this.view.x = rect.width / 2 - ((bb.x0 + bb.x1) / 2) * CELL * zoom;
    this.view.y = rect.height / 2 - ((bb.y0 + bb.y1) / 2) * CELL * zoom;
    this.#applyView();
    if (instant) requestAnimationFrame(() => this.el.world.classList.remove('instant'));
  }

  #applyView() {
    const { x, y, zoom } = this.view;
    this.el.world.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
  }

  zoomBy(f, cx, cy) {
    const rect = this.el.board.getBoundingClientRect();
    cx ??= rect.width / 2;
    cy ??= rect.height / 2;
    const z = Math.min(2.5, Math.max(0.25, this.view.zoom * f));
    const k = z / this.view.zoom;
    this.view.x = cx - (cx - this.view.x) * k;
    this.view.y = cy - (cy - this.view.y) * k;
    this.view.zoom = z;
    this.el.world.classList.add('instant');
    this.#applyView();
  }

  #bindPanZoom() {
    const b = this.el.board;
    const ptrs = new Map();
    let last = 0;
    b.addEventListener('pointerdown', (e) => {
      b.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      last = this.#dist(ptrs);
      this.el.world.classList.add('instant');
    });
    b.addEventListener('pointermove', (e) => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 1) {
        this.view.x += dx; this.view.y += dy;
        this.#applyView();
      } else if (ptrs.size === 2) {
        const d = this.#dist(ptrs);
        const r = b.getBoundingClientRect();
        const [a, c] = [...ptrs.values()];
        if (last) this.zoomBy(d / last, (a.x + c.x) / 2 - r.left, (a.y + c.y) / 2 - r.top);
        last = d;
      }
    });
    const up = (e) => { ptrs.delete(e.pointerId); last = this.#dist(ptrs); };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = b.getBoundingClientRect();
      this.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    b.addEventListener('keydown', (e) => {
      const step = 60;
      const m = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
      if (m) {
        e.preventDefault();
        this.view.x += m[0]; this.view.y += m[1];
        this.el.world.classList.add('instant');
        this.#applyView();
      } else if (e.key === '+' || e.key === '=') this.zoomBy(1.2);
      else if (e.key === '-') this.zoomBy(1 / 1.2);
    });
  }

  #dist(ptrs) {
    if (ptrs.size < 2) return 0;
    const [a, b] = [...ptrs.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  toast(msg) {
    this.el.toast.textContent = msg;
    this.el.toast.classList.add('show');
    clearTimeout(this._t);
    this._t = setTimeout(() => this.el.toast.classList.remove('show'), 1600);
  }
}
