import { WORD_LENGTH } from './placementValidator.js';

/** Current-row letter buffer. Locked positions are pre-filled and never editable. */
export class GuessBuffer {
  constructor(locked = {}) { this.reset(locked); }

  reset(locked = {}) {
    this.locked = locked;
    this.letters = Array.from({ length: WORD_LENGTH }, (_, i) => locked[i] || '');
  }

  isLocked(i) { return i in this.locked; }

  add(letter) {
    const i = this.letters.findIndex((l, idx) => !l && !this.isLocked(idx));
    if (i === -1) return false;
    this.letters[i] = letter;
    return true;
  }

  backspace() {
    for (let i = WORD_LENGTH - 1; i >= 0; i--) {
      if (!this.isLocked(i) && this.letters[i]) { this.letters[i] = ''; return true; }
    }
    return false;
  }

  get complete() { return this.letters.every(Boolean); }
  get word() { return this.letters.join(''); }
}

/** Wires physical keyboard and on-screen keyboard to handlers. */
export function bindInput({ keyboardEl, onLetter, onBackspace, onEnter, isBlocked }) {
  const dispatch = (k) => {
    if (isBlocked()) return;
    if (k === 'enter') onEnter();
    else if (k === 'backspace') onBackspace();
    else if (/^[a-z]$/.test(k)) onLetter(k);
  };
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    // let focused buttons/dialogs handle Enter/Space themselves
    if (e.key === 'Enter' && t instanceof HTMLElement && t.closest('button, dialog, [role="dialog"]')) return;
    const k = e.key.toLowerCase();
    if (k === 'enter' || k === 'backspace' || /^[a-z]$/.test(k)) {
      if (k === 'backspace' && t instanceof HTMLElement && t.closest('[role="application"]') === null) e.preventDefault();
      dispatch(k);
    }
  });
  keyboardEl.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-key]');
    if (b) dispatch(b.dataset.key);
  });
}
