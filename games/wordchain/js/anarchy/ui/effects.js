import { el, reduceMotion } from './dom.js';

/** Restrained, short-lived effects. Every effect removes itself and is skipped for reduced motion. */
const timers = new Set();
const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };

/** Cancels pending effect cleanups (used when the run is restarted or the mode changes). */
export function clearEffects(root = document.body) {
  for (const t of timers) clearTimeout(t);
  timers.clear();
  for (const n of root.querySelectorAll('.fx')) n.remove();
  document.body.classList.remove('fx-shake');
  document.getElementById('app')?.removeAttribute('data-event');
}

/** Small burst of coins rising from `origin` (an element). */
export function coinBurst(origin, n = 6) {
  if (reduceMotion() || !origin) return;
  const r = origin.getBoundingClientRect();
  for (let i = 0; i < Math.min(n, 10); i++) {
    const c = el('span', 'fx coin-fx', '🪙');
    c.style.left = `${r.left + r.width / 2}px`;
    c.style.top = `${r.top + r.height / 2}px`;
    c.style.setProperty('--dx', `${(i - n / 2) * 14}px`);
    c.style.setProperty('--delay', `${i * 40}ms`);
    c.setAttribute('aria-hidden', 'true');
    document.body.append(c);
    later(() => c.remove(), 1100);
  }
}

/** Brief screen shake (single, short). */
export function shake(ms = 450) {
  if (reduceMotion()) return;
  document.body.classList.add('fx-shake');
  later(() => document.body.classList.remove('fx-shake'), ms);
}

/** Sets the accent for an event ("jackpot", "quake", "boss", "storm", "chain", "bonus", "roulette"); cleared automatically. */
export function accent(kind, ms = 2400) {
  const app = document.getElementById('app');
  if (!app) return;
  if (kind) app.dataset.event = kind; else app.removeAttribute('data-event');
  if (kind && !reduceMotion()) later(() => { if (app.dataset.event === kind) app.removeAttribute('data-event'); }, ms);
}

/** Pulses cells (by key) one group at a time along a path, e.g. a chain reaction. */
export function pulseCells(cellEls, steps, { onStep } = {}) {
  steps.forEach((keys, i) => later(() => {
    for (const k of keys) {
      const n = cellEls.get(k);
      if (!n) continue;
      n.classList.add('pulse');
      later(() => n.classList.remove('pulse'), 700);
    }
    onStep?.(i);
  }, reduceMotion() ? 0 : i * 260));
}
