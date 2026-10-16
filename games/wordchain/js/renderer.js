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
    this.ghostEls = [];
    this.gridSize = null;
    this.#buildGuessGrid();
    this.#buildKeyboard();
    this.#bindPanZoom();
  }

  /** (Re)builds the guess grid; the grid adapts to the answer length and the attempts available. */
  #buildGuessGrid(len = WORD_LENGTH, attempts = MAX_ATTEMPTS) {
    const g = this.el.guesses;
    g.innerHTML = '';
    g.style.setProperty('--len', len);
    this.gridSize = { len, attempts };
    this.rows = [];
    for (let r = 0; r < attempts; r++) {
      const row = document.createElement('div');
      row.className = 'row';
      row.setAttribute('role', 'row');
      const tiles = [];
      for (let c = 0; c < len; c++) {
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
    const want = { len: engine.wordLength, attempts: engine.maxAttempts };
    if (engine.current && (want.len !== this.gridSize.len || want.attempts !== this.gridSize.attempts)) this.#buildGuessGrid(want.len, want.attempts);
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
    const e = this.el;
    const playing = engine.status === 'playing';
    e.wordNum.textContent = playing ? Math.max(engine.wordNumber, engine.phase === 'choosing' ? engine.solved + 1 : 0) : engine.solved;
    e.score.textContent = engine.score;
    e.attempts.textContent = playing && engine.current ? Math.max(0, engine.attemptsLeft) : playing ? engine.mode.attempts : 0;
    e.best.textContent = Math.max(best, engine.score);
    if (e.mode) e.mode.textContent = `${engine.mode.icon} ${engine.mode.name}`;
    if (e.tokensBox) {
      e.tokensBox.hidden = !engine.resources;
      if (engine.resources) e.tokens.textContent = engine.resources.tokens;
    }
    this.#renderObjective(engine);
  }

  #renderObjective(engine) {
    const box = this.el.objective;
    if (!box) return;
    const o = engine.challenges?.current;
    box.hidden = !engine.challenges;
    if (!engine.challenges) return;
    if (!o) { box.querySelector('.obj-text').textContent = 'Objective: none available right now'; box.querySelector('.obj-bar').style.width = '0%'; return; }
    box.querySelector('.obj-text').textContent = `Objective: ${o.text}`;
    box.querySelector('.obj-progress').textContent = `${o.progress}/${o.target} · +${o.reward.score}${o.reward.tokens ? ` & ${o.reward.tokens}🪙` : ''}`;
    box.querySelector('.obj-bar').style.width = Math.round((o.progress / o.target) * 100) + '%';
  }

  /** Hint / Extra Try buttons (strategic modes). `handlers`: { hint, extraTry }. */
  renderPowerups(engine) {
    const box = this.el.powerups;
    if (!box) return;
    const r = engine.resources;
    const active = !!r && engine.phase === 'guessing' && engine.status === 'playing';
    box.hidden = !r;
    if (!r) return;
    for (const [kind, btn] of [['hint', this.el.hintBtn], ['extraTry', this.el.extraBtn]]) {
      const c = r.check(kind);
      btn.disabled = !active || !c.ok;
      btn.title = !c.ok && c.error ? c.error : '';
      btn.querySelector('.cost').textContent = `${r.cost[kind]}🪙`;
    }
  }

  /** Score breakdown after a solved word. Hidden for Classic (original presentation). */
  renderBreakdown(bd, mode) {
    const box = this.el.breakdown;
    if (!box) return;
    if (!bd || mode.id === 'classic') { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = '';
    const h = document.createElement('p');
    h.className = 'bd-title';
    h.textContent = `Word score +${bd.total}${bd.tokens ? ` · +${bd.tokens} 🪙` : ''}`;
    const ul = document.createElement('ul');
    for (const it of bd.items) {
      const li = document.createElement('li');
      const a = document.createElement('span');
      a.textContent = it.label;
      const b = document.createElement('b');
      b.textContent = (it.points >= 0 ? '+' : '') + it.points;
      li.append(a, b);
      ul.append(li);
    }
    box.append(h, ul);
  }

  /**
   * Draws placement choices on the board (footprint outlines, intersections, no answers) and the choice cards.
   * handlers: { choose(id), reroll(id), preview(id) }. Ghost cells live in the pannable/zoomable world.
   */
  renderChoice(engine, handlers, { selected = null } = {}) {
    const opts = engine.publicOptions;
    this.clearGhosts();
    const frag = document.createDocumentFragment();
    const wrap = this.el.options;
    wrap.innerHTML = '';
    const names = { expand: 'Expand', connect: 'Connect', junction: 'Junction' };
    const hints = { expand: 'Grow into open space', connect: 'Links existing words', junction: 'Joins branches for a bonus' };
    opts.forEach((o, n) => {
      const tag = 'ABC'[n];
      const [dx, dy] = o.dir === 'across' ? [1, 0] : [0, 1];
      const known = new Map(o.intersections.map((i) => [i.index, i.letter]));
      for (let i = 0; i < o.length; i++) {
        const d = document.createElement('div');
        d.className = `ghost cat-${o.category}` + (known.has(i) ? ' intersect' : '') + (selected === o.id ? ' hot' : selected ? ' dim' : '') + (i === 0 ? ' first' : '');
        d.style.transform = `translate(${(o.x + dx * i) * CELL}px, ${(o.y + dy * i) * CELL}px)`;
        if (i === 0) d.dataset.tag = tag;
        frag.append(d);
        this.ghostEls.push(d);
      }
      const card = document.createElement('article');
      card.className = `opt cat-${o.category}` + (selected === o.id ? ' selected' : '');
      card.dataset.id = o.id;
      const pattern = Array.from({ length: o.length }, (_, i) => (known.has(i) ? known.get(i).toUpperCase() : '_')).join(' ');
      const where = o.intersections.map((i) => `${i.letter.toUpperCase()} (letter ${i.index + 1})`).join(', ');
      const title = document.createElement('h3');
      title.textContent = `${tag} · ${names[o.category]}`;
      const meta = document.createElement('p');
      meta.className = 'opt-meta';
      meta.textContent = `${o.dir === 'across' ? 'Across →' : 'Down ↓'} · ${o.length} letters · ${hints[o.category]}`;
      const pat = document.createElement('p');
      pat.className = 'opt-pattern';
      pat.textContent = pattern;
      pat.setAttribute('aria-label', `Known letters: ${where}`);
      const info = document.createElement('p');
      info.className = 'opt-info';
      info.textContent = `${o.crossings} intersection${o.crossings === 1 ? '' : 's'}: ${where}`;
      const row = document.createElement('div');
      row.className = 'opt-actions';
      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'primary';
      pick.textContent = opts.length === 1 ? 'Continue' : 'Choose';
      pick.addEventListener('click', () => handlers.choose(o.id));
      row.append(pick);
      if (engine.resources) {
        const rr = document.createElement('button');
        rr.type = 'button';
        const c = engine.resources.check('reroll');
        rr.textContent = `Reroll ${engine.resources.cost.reroll}🪙`;
        rr.disabled = !c.ok;
        rr.title = c.ok ? 'Replace this placement with another' : c.error;
        rr.addEventListener('click', () => handlers.reroll(o.id));
        row.append(rr);
      }
      card.append(title, meta, pat, info, row);
      for (const ev of ['mouseenter', 'focusin']) card.addEventListener(ev, () => handlers.preview(o.id));
      card.addEventListener('click', (e) => { if (!e.target.closest('button')) handlers.preview(o.id); });
      wrap.append(card);
    });
    this.el.world.append(frag);
  }

  clearGhosts() {
    for (const g of this.ghostEls) g.remove();
    this.ghostEls = [];
  }

  /** Frame the whole crossword together with every offered footprint. */
  focusOptions(engine, { instant = false } = {}) {
    const cells = [];
    for (const w of engine.board.words) cells.push(...cellsOf(w.word, w.x, w.y, w.dir));
    for (const o of engine.publicOptions) {
      const [dx, dy] = o.dir === 'across' ? [1, 0] : [0, 1];
      for (let i = 0; i < o.length; i++) cells.push({ x: o.x + dx * i, y: o.y + dy * i });
    }
    if (cells.length) this.#frame(cells, { maxZoom: 1.3, minZoom: 0.25, instant });
  }

  /** Called with a board cell { x, y } when the board is tapped (not dragged). */
  onBoardTap(fn) { this.tapHandler = fn; }

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
    let tap = null; // pointer-down position, cleared once the pointer moves (drag/pinch)
    b.addEventListener('pointerdown', (e) => {
      tap = ptrs.size === 0 ? { x: e.clientX, y: e.clientY } : null;
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
      if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 6) tap = null;
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
    b.addEventListener('pointerup', (e) => {
      if (tap && this.tapHandler) {
        const r = b.getBoundingClientRect();
        const { x, y, zoom } = this.view;
        this.tapHandler({ x: Math.floor((e.clientX - r.left - x) / (CELL * zoom)), y: Math.floor((e.clientY - r.top - y) / (CELL * zoom)) });
      }
      tap = null;
      up(e);
    });
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
