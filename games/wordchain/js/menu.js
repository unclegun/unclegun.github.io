/**
 * Mode-selection menu. Pure DOM and callbacks: it knows nothing about the engine or storage.
 *   getInfo(modeId) -> { best, saved: { words, score } | null }
 *   onPlay(modeId, { fresh })  - called after any needed overwrite confirmation
 */
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

/** Promise-based confirmation using a <dialog> with .confirm-yes / .confirm-no buttons and a .confirm-text node. */
export function askConfirm(dialog, message, { yes = 'Yes', no = 'Cancel' } = {}) {
  return new Promise((resolve) => {
    const text = dialog.querySelector('.confirm-text');
    const y = dialog.querySelector('.confirm-yes');
    const n = dialog.querySelector('.confirm-no');
    text.textContent = message;
    y.textContent = yes;
    n.textContent = no;
    const done = (v) => { y.onclick = n.onclick = null; dialog.onclose = null; if (dialog.open) dialog.close(); resolve(v); };
    y.onclick = () => done(true);
    n.onclick = () => done(false);
    dialog.onclose = () => done(false); // Escape
    dialog.showModal();
    n.focus();
  });
}

export function createMenu({ root, modes, getInfo, onPlay, confirmDialog, currentMode = () => null }) {
  const list = root.querySelector('#mode-cards');

  async function play(mode, fresh, info) {
    if (fresh && info.saved) {
      const ok = await askConfirm(confirmDialog, `Start a new ${mode.name} run? Your unfinished run (${info.saved.words} words, ${info.saved.score} points) will be replaced.`, { yes: 'Start new run', no: 'Keep my run' });
      if (!ok) return;
    }
    onPlay(mode.id, { fresh });
  }

  function render() {
    list.innerHTML = '';
    for (const mode of modes) {
      const info = getInfo(mode.id);
      const card = el('article', 'mode-card' + (mode.id === 'classic' ? ' original' : '') + (currentMode() === mode.id ? ' current' : ''));
      card.dataset.mode = mode.id;
      card.setAttribute('aria-labelledby', `mode-${mode.id}-name`);
      const head = el('div', 'mode-head');
      const icon = el('span', 'mode-icon', mode.icon);
      icon.setAttribute('aria-hidden', 'true');
      const name = el('h2', 'mode-name', mode.name);
      name.id = `mode-${mode.id}-name`;
      head.append(icon, name, el('span', 'mode-badge', mode.id === 'classic' ? 'Original experience' : mode.badge));
      const tag = mode.tagline ? el('p', 'mode-tagline', mode.tagline) : null;
      const desc = el('p', 'mode-desc', mode.description);
      const stats = el('p', 'mode-stats');
      stats.append(el('span', '', `Best: ${info.best.score}`), el('span', '', info.best.words ? ` · ${info.best.words} words` : ''));
      const actions = el('div', 'mode-actions');
      const fresh = el('button', info.saved ? '' : 'primary', 'New Game');
      fresh.type = 'button';
      fresh.setAttribute('aria-label', `New ${mode.name} game`);
      fresh.addEventListener('click', (e) => { e.stopPropagation(); play(mode, true, info); });
      if (info.saved) {
        const cont = el('button', 'primary', 'Continue');
        cont.type = 'button';
        cont.setAttribute('aria-label', `Continue ${mode.name}: ${info.saved.words} words, ${info.saved.score} points`);
        cont.addEventListener('click', (e) => { e.stopPropagation(); play(mode, false, info); });
        actions.append(cont);
        stats.append(el('span', 'mode-saved', ` · Saved run: ${info.saved.words} words, ${info.saved.score} pts`));
      }
      actions.append(fresh);
      if (tag) card.append(head, tag, desc, stats, actions); else card.append(head, desc, stats, actions);
      card.addEventListener('click', (e) => { if (!e.target.closest('button')) play(mode, !info.saved, info); });
      list.append(card);
    }
  }

  return { render };
}
