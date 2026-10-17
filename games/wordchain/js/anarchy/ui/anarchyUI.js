import { el, button } from './dom.js';
import { mountPuzzleView, unmountPuzzleViews } from './puzzleViews.js';
import { coinBurst, shake, accent, pulseCells, clearEffects } from './effects.js';
import { ECONOMY } from '../arcadeEconomy.js';
import { listMinigames } from '../puzzles/index.js';
import { EVENTS } from '../eventRegistry.js';
import { CHAOS, percent, nearlyFull } from '../chaosMeter.js';

const ACCENTS = { letter_forge: 'bonus', jackpot: 'jackpot', wordquake: 'quake', gravity_shift: 'quake', letter_storm: 'storm', chain_reaction: 'chain', boss_word: 'boss', mutating_rules: 'roulette', heist: 'boss', survival: 'boss' };
const TIER_LABEL = { minor: 'Minor', major: 'Major', rare: 'Rare' };

/**
 * Anarchy interface controller. All rules live in AnarchyGame; this module only draws the HUD, the event card,
 * the shop, the puzzle dialogs and effects, then calls back into main.js through `hooks`:
 *   hooks.persist(), hooks.toast(msg), hooks.say(msg), hooks.refresh(), hooks.startRound(), hooks.endRun(complete),
 *   hooks.lockLetter(index, letter), hooks.isBusy()
 */
export function createAnarchyUI({ hud, eventDialog, sideDialog, renderer, hooks, getGame }) {
  const q = (sel) => hud.querySelector(sel);
  const $coins = q('#an-coins');
  const $chips = q('#an-chips');
  const $meter = q('#an-meter');
  const $goal = q('#an-goal');
  const $shop = q('#an-shop');
  const $detour = q('#an-detour');
  const $shield = q('#an-shield');
  const $chaos = q('#an-chaos');
  const $inv = q('#an-inv');
  let stepping = false;

  // HUD buttons. createAnarchyUI runs once per page load, so these handlers are attached exactly once
  // (restarting or switching modes only resets dialogs; it never re-binds listeners).
  $shop.addEventListener('click', () => openShop());
  $detour.addEventListener('click', () => openDetours());
  $shield.addEventListener('click', () => armShield());

  function armShield() {
    const g = getGame();
    if (!g) return;
    const r = g.useShield();
    if (!r.ok) { hooks.toast(r.error); return; }
    hooks.persist();
    hooks.toast('🛡️ Shield armed: your next miss is free');
    accent('bonus', 900);
    renderHud();
  }

  eventDialog.addEventListener('cancel', (e) => e.preventDefault()); // event cards and puzzles must be resolved, never dismissed by accident
  sideDialog.addEventListener('close', () => {
    if (sideDialog.open) return; // closed and immediately reopened (close events are asynchronous)
    const g = getGame();
    unmountPuzzleViews();
    if (g?.detour) { g.finishDetour(); hooks.persist(); }
    hooks.refresh();
    renderHud();
    if (g?.phase === 'announce' && eventDialog.open) renderCard();
  });
  sideDialog.addEventListener('click', (e) => { if (e.target === sideDialog) sideDialog.close(); });

  // ---------- HUD ----------
  function renderHud() {
    const g = getGame();
    if (!g) return;
    $coins.textContent = g.coins;
    $chips.replaceChildren();
    let meter = null;
    for (const c of g.chips) {
      const chip = el('span', `chip tier-${c.tier}${c.announced ? ' pending' : ''}`, `${c.icon} ${c.name}`, { title: c.scope || '' });
      if (c.scope) chip.append(el('small', '', ` · ${c.scope}`));
      $chips.append(chip);
      if (c.progress) meter = c.progress;
    }
    for (const f of g.effects) $chips.append(el('span', 'chip tier-effect', `${f.icon} ${f.label}`, { title: `Carried from an earlier event. Expires after word ${f.expiresRound}.`, role: 'note' }));
    $meter.hidden = !meter;
    if (meter) {
      $meter.replaceChildren(el('span', 'meter-label', `${meter.label} ${meter.value}/${meter.max}`), el('div', 'meter-track', '', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(meter.max), 'aria-valuenow': String(meter.value), 'aria-label': meter.label }));
      const bar = el('div', `meter-bar tone-${meter.tone || 'info'}`);
      bar.style.width = `${Math.round((meter.value / meter.max) * 100)}%`;
      $meter.querySelector('.meter-track').append(bar);
    }
    const goal = g.phase === 'guessing' ? g.goal : null;
    $goal.hidden = goal === null;
    $goal.textContent = goal === null ? '' : `Goal: solve in ${goal} or fewer`;
    const ch = g.chaos;
    $chaos.className = `an-chaos${ch.value >= CHAOS.threshold * 0.9 ? ' hot' : nearlyFull(ch) ? ' warm' : ''}`;
    $chaos.replaceChildren(el('span', '', `🌪️ Chaos ${percent(ch)}%`), el('div', 'track', '', { role: 'progressbar', 'aria-label': 'Chaos Meter', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(percent(ch)) }));
    $chaos.querySelector('.track').append(Object.assign(el('div', 'bar'), { style: `width:${percent(ch)}%` }));
    $chaos.title = ch.catalyst ? 'Catalyst active: the next major event pays a coin bonus.' : 'Chaos Meter: fills as you solve words. When full, a major event strikes.';
    renderInventory(g);
    const idle = g.phase === 'guessing' || g.phase === 'announce';
    $shop.disabled = g.phase === 'over' || g.phase === 'transition';
    $detour.disabled = !idle || !!g.detour;
    const shields = g.economy.held('shield');
    $shield.hidden = !(shields > 0 || g.economy.s.shieldArmed);
    $shield.disabled = g.phase !== 'guessing' || g.economy.s.shieldArmed;
    $shield.textContent = g.economy.s.shieldArmed ? '🛡️ Armed' : `🛡️ ×${shields}`;
    $shield.setAttribute('aria-label', g.economy.s.shieldArmed ? 'Mistake shield armed' : `Arm Mistake Shield (${shields} held)`);
  }

  let lastInv = {};
  function renderInventory(g) {
    const now = {};
    $inv.replaceChildren();
    const add = (key, label, qty, cls = '') => {
      now[key] = qty;
      const item = el('span', `inv-item ${cls}${qty > (lastInv[key] || 0) ? ' bump' : ''}`, `${label} ×${qty}`);
      $inv.append(item);
    };
    for (const [id, d] of Object.entries(ECONOMY.items)) if (d.kind === 'held' && g.economy.held(id) > 0) add(id, `${d.icon} ${d.name}`, g.economy.held(id), id === 'shield' && g.economy.s.shieldArmed ? 'armed' : '');
    if (g.economy.s.shieldArmed) $inv.append(el('span', 'inv-item armed', '🛡️ Shield armed'));
    if (g.economy.held('freeReveal')) add('freeReveal', '💡 Free Reveal', g.economy.held('freeReveal'));
    if (g.economy.held('freeGuess')) add('freeGuess', '➕ Free Guess', g.economy.held('freeGuess'));
    if (g.economy.s.doubleCoins) $inv.append(el('span', 'inv-item armed', `✨ Double Coins: ${g.economy.s.doubleCoins} words`));
    lastInv = now;
  }

  // ---------- flow ----------
  /** Moves the UI to whatever the game's phase requires. Safe to call repeatedly. */
  function step() {
    const g = getGame();
    if (!g || stepping) return;
    stepping = true;
    try {
      if (g.phase === 'transition') { g.proceed(); hooks.persist(); }
      renderHud();
      if (g.phase === 'over') { closeAll(); hooks.endRun(g.status === 'complete'); return; }
      if (g.phase === 'announce') { hooks.refresh(); showCard(); return; }
      if (g.phase === 'event') { hooks.refresh(); showPuzzle(); return; }
      if (eventDialog.open) eventDialog.close();
      if (g.detour) openDetour();
      else closeAll();
      hooks.startRound();
    } finally { stepping = false; }
  }

  function closeAll() {
    unmountPuzzleViews();
    if (sideDialog.open) sideDialog.close();
    if (eventDialog.open) eventDialog.close();
  }

  /** Cancels dialogs/effects without touching game state (restart, menu, mode switch). */
  function reset() {
    unmountPuzzleViews();
    clearEffects();
    if (sideDialog.open) sideDialog.close();
    if (eventDialog.open) eventDialog.close();
  }

  // ---------- event card ----------
  let picks = {};
  function showCard() {
    picks = {};
    renderCard();
    if (!eventDialog.open) eventDialog.showModal();
    const a = getGame().announcement();
    const first = a?.cards[0];
    if (first) { accent(ACCENTS[first.id] || (first.tier === 'major' ? 'quake' : null)); if (first.id === 'boss_word') shake(300); }
    hooks.say(a?.cards.map((c) => `${c.name}. ${c.text}`).join(' ') || '');
  }

  function renderCard() {
    const g = getGame();
    const a = g.announcement();
    if (!a) return;
    eventDialog.className = 'an-dialog card';
    const body = el('div', 'an-card-body');
    body.append(el('p', 'an-kicker', 'Rule change'));
    for (const c of a.cards) {
      const sec = el('section', `event-card tier-${c.tier}`, '', { 'aria-label': c.name });
      sec.append(el('h2', '', `${c.icon} ${c.name}`), el('span', 'tier-badge', TIER_LABEL[c.tier] || c.kind), el('p', 'event-text', c.text));
      if (c.choices) {
        const group = el('div', 'choices', '', { role: 'radiogroup', 'aria-label': `${c.name} options` });
        const preset = c.choices.find((x) => x.id === 'skip');
        if (preset && !picks[c.id]) picks[c.id] = preset.id;
        for (const ch of c.choices) {
          const lab = el('label', 'choice-opt');
          const r = el('input', '', '', { type: 'radio', name: `choice-${c.id}`, value: ch.id });
          r.checked = picks[c.id] === ch.id;
          r.addEventListener('change', () => { picks[c.id] = ch.id; update(); });
          lab.append(r, el('span', '', ch.label), el('small', '', ch.desc || ''));
          group.append(lab);
        }
        sec.append(group);
      }
      body.append(sec);
    }
    const foot = el('div', 'an-foot');
    const go = button('Begin', () => accept(), 'primary-btn');
    const reroll = button(`🎲 Reroll (${a.rerolls})`, () => { const r = g.useReroll(); if (!r.ok) hooks.toast(r.error); hooks.persist(); renderHud(); renderCard(); }, 'secondary');
    reroll.hidden = !a.cards.some((c) => c.rerollable) || a.rerolls < 1;
    foot.append(reroll, button('🪙 Shop', () => openShop(), 'secondary'), button('🧩 Detours', () => openDetours(), 'secondary'), go);
    const update = () => { go.disabled = a.cards.some((c) => c.choices && !picks[c.id]); };
    body.append(foot);
    eventDialog.replaceChildren(body);
    update();
    go.focus();
  }

  function accept() {
    const g = getGame();
    const r = g.accept(picks);
    if (!r.ok) { hooks.toast(r.error); return; }
    hooks.persist();
    eventDialog.close();
    step();
  }

  // ---------- puzzle events ----------
  function showPuzzle() {
    const g = getGame();
    const p = g.puzzle;
    const en = g.interlude || g.entries.find((e) => e.id === 'reverse_wordle');
    const def = EVENTS[en?.id] || {};
    eventDialog.className = 'an-dialog puzzle';
    const wrap = el('div', 'an-card-body');
    wrap.append(el('p', 'an-kicker', def.tier ? `${TIER_LABEL[def.tier]} event` : 'Event'), el('h2', '', `${def.icon || ''} ${def.name || 'Challenge'}`));
    const host = el('div', 'puzzle-host', '', { tabindex: '-1' });
    const foot = el('div', 'an-foot');
    const done = button('Done', () => finish(), 'primary-btn');
    const stab = button('⚓ Stabilize', () => finish({ stabilize: true }), 'secondary');
    const skip = button('Skip', () => finish({ giveUp: true }), 'secondary', { title: 'Leave without a reward' });
    const shopBtn = button('🪙 Shop', () => openShop(), 'secondary');
    const sync = () => {
      const ready = p.type === 'collapse' || p.type === 'forge' ? p.isSolved(g.dictionary) : p.type === 'chain' ? true : p.isSolved();
      done.disabled = !ready;
      stab.hidden = !def.stabilizable || g.economy.held('stabilizer') < 1;
      renderHud();
    };
    const ctx = {
      game: g,
      toast: hooks.toast,
      changed: () => { sync(); hooks.persist(); },
      pulse: (steps) => pulseCells(renderer.cellEls, steps),
      submitReverse: (word, status) => {
        const r = g.submitReverse(word);
        if (!r.ok) { status.textContent = r.error; return; }
        hooks.persist();
        if (r.solved) { eventDialog.close(); accent('bonus'); resultFx(r.res); step(); return; }
        if (r.failed) { hooks.toast('Out of tries. Playing it as a normal word.'); eventDialog.close(); step(); return; }
        status.textContent = `Not consistent with the clues. ${p.attemptsLeft} tries left.`;
      },
    };
    mountPuzzleView(p, host, ctx);
    if (p.type !== 'reverse') foot.append(shopBtn, skip, stab, done); else foot.append(shopBtn);
    wrap.append(host, foot);
    eventDialog.replaceChildren(wrap);
    sync();
    if (!eventDialog.open) eventDialog.showModal();
    accent(ACCENTS[en?.id] || null);
    hooks.say(`${def.name}. ${def.describe ? def.describe(en) : ''}`);
    host.focus();
  }

  function finish(opts = {}) {
    const g = getGame();
    const r = g.completeEvent(opts);
    if (!r.ok) { hooks.toast(r.error); return; }
    hooks.persist();
    if (r.reward.coins || r.reward.score) {
      accent('bonus');
      coinBurst(q('.an-coins'), r.reward.coins);
      hooks.toast(`${r.reward.label}: +${r.reward.coins}🪙 +${r.reward.score}${r.reward.effect ? ` · Next: ${r.reward.effect}` : ''}`);
    } else hooks.toast(r.reward.label);
    eventDialog.close();
    hooks.refresh();
    step();
  }

  // ---------- shop and detours ----------
  function openSide(title, content) {
    sideDialog.className = 'an-dialog side';
    const wrap = el('div', 'an-card-body');
    const head = el('div', 'an-side-head');
    head.append(el('h2', '', title), button('✕', () => sideDialog.close(), 'icon-btn', { 'aria-label': 'Close' }));
    wrap.append(head, content);
    sideDialog.replaceChildren(wrap);
    if (!sideDialog.open) sideDialog.showModal();
  }

  const GROUPS = [['Use now', (d) => d.kind !== 'held'], ['Buy for later (kept in your inventory)', (d) => d.kind === 'held']];
  let justBought = null;

  /** Purchase lifecycle: validate (canBuy) → commit atomically inside g.buy → apply effect → persist → refresh HUD → confirm. */
  function purchase(id, d, opts = {}) {
    const g = getGame();
    const before = g.coins;
    const r = g.buy(id, opts);
    if (!r.ok) { hooks.toast(r.error); return r; }
    if (r.item === 'reveal') hooks.lockLetter(r.index, r.letter);
    hooks.persist();
    hooks.refresh();
    justBought = id;
    const spent = before - g.coins;
    const msgs = { reveal: `Letter ${r.index + 1} is ${String(r.letter).toUpperCase()}`, extraGuess: 'Extra guess added', chaosCatalyst: `Chaos rises to ${r.chaos}%`, chaosBrake: `Chaos falls to ${r.chaos}%`, doubleCoins: 'Double Coins active' };
    hooks.toast(`${d.icon} ${d.name}${spent ? ` −${spent}🪙` : ' (free)'}: ${msgs[id] || (d.kind === 'held' ? 'added to inventory' : 'applied')}`);
    if (id === 'reveal' || id === 'extraGuess') accent('bonus', 900);
    hooks.onPurchase?.(id, spent);
    return r;
  }

  function openShop() {
    const g = getGame();
    if (!g || g.phase === 'over' || g.phase === 'transition') return;
    hooks.onShopOpen?.();
    const list = el('ul', 'shop-list');
    const balance = el('p', 'shop-balance', '', { 'aria-live': 'polite' });
    const wrap = el('div');
    const draw = () => {
      list.replaceChildren();
      balance.textContent = `You have ${g.coins} coins. Score is never spent.`;
      for (const [title, pick] of GROUPS) {
        list.append(el('li', 'shop-group', title));
        for (const [id, d] of Object.entries(ECONOMY.items).filter(([, x]) => pick(x))) {
          const c = g.canBuy(id);
          const held = d.kind === 'held' ? g.economy.held(id) : null;
          const li = el('li', `shop-item${justBought === id ? ' bought' : ''}`);
          const info = el('div', 'shop-info');
          info.append(el('strong', '', `${d.icon} ${d.name}`), el('small', '', d.desc),
            el('small', 'muted', held !== null ? `Held ${held}/${d.maxHeld}` : id === 'doubleCoins' && g.economy.s.doubleCoins ? `Active: ${g.economy.s.doubleCoins} words left` : ''));
          if (!c.ok) info.append(el('small', 'shop-why', `Unavailable: ${c.error}`));
          const b = button(`${d.cost}🪙`, () => { b.disabled = true; purchase(id, d); renderHud(); draw(); }, 'buy', { 'aria-label': `Buy ${d.name} for ${d.cost} coins`, title: c.ok ? '' : c.error || '' });
          b.disabled = !c.ok;
          li.append(info, b);
          const creditKind = id === 'reveal' ? 'freeReveal' : id === 'extraGuess' ? 'freeGuess' : null;
          if (creditKind && g.economy.held(creditKind) > 0) {
            const free = g.canBuy(id, { credit: true });
            const fb = button(`Use free (${g.economy.held(creditKind)})`, () => { purchase(id, d, { credit: true }); renderHud(); draw(); }, 'secondary free');
            fb.disabled = !free.ok;
            li.append(fb);
          }
          list.append(li);
        }
      }
      justBought = null;
    };
    wrap.append(balance, list);
    draw();
    openSide('Shop', wrap);
  }

  function openDetours() {
    const g = getGame();
    if (!g) return;
    if (g.detour) { openDetour(); return; }
    const list = el('ul', 'shop-list');
    for (const m of listMinigames()) {
      const c = g.canDetour(m.id);
      const li = el('li', 'shop-item');
      const info = el('div', 'shop-info');
      info.append(el('strong', '', `${m.icon} ${m.name}`), el('small', '', m.blurb), el('small', 'muted', c.ok ? `Reward: ${c.reward.label}` : c.error));
      const b = button('Play', () => { const r = g.startDetour(m.id); if (!r.ok) { hooks.toast(r.error); return; } hooks.persist(); renderHud(); openDetour(); }, 'buy');
      b.disabled = !c.ok;
      li.append(info, b);
      list.append(li);
    }
    openSide('Puzzle Detours', el('div', '', '', {}));
    const wrap = sideDialog.querySelector('.an-card-body');
    wrap.append(el('p', 'shop-balance', 'Optional. One reward per round, a few per run. Your run is paused while you play.'), list);
  }

  function openDetour() {
    const g = getGame();
    const dt = g?.detour;
    if (!dt) return;
    const host = el('div', 'puzzle-host', '', { tabindex: '-1' });
    const p = g.detourPuzzle;
    const wrap = el('div');
    const claim = button(`Claim: ${dt.reward.label}`, () => {
      const r = g.finishDetour();
      hooks.persist();
      sideDialog.close();
      if (r.solved) { accent('bonus'); coinBurst(q('.an-coins'), 4); hooks.toast(`Detour complete: ${r.reward.label}`); }
    }, 'primary-btn');
    const sync = () => { claim.disabled = !p.isSolved(); };
    const ctx = { game: g, toast: hooks.toast, changed: () => { g.s.detour.puzzle = p.toJSON(); sync(); hooks.persist(); } };
    mountPuzzleView(p, host, ctx);
    const foot = el('div', 'an-foot');
    foot.append(button('Leave (no reward)', () => sideDialog.close(), 'secondary'), claim);
    wrap.append(el('p', 'shop-balance', `Reward: ${dt.reward.label}`), host, foot);
    openSide(`${listMinigames().find((m) => m.id === dt.id)?.icon || ''} ${listMinigames().find((m) => m.id === dt.id)?.name || 'Detour'}`, wrap);
    sync();
  }

  // ---------- results of a guess ----------
  /** Called after a guess is evaluated (before the solved animation). */
  function onGuess(res) {
    for (const n of res.notes || []) {
      if (n.alarm) { shake(300); accent('boss', 1200); hooks.toast('🚨 Alarm tripped! Unbanked loot lost.'); }
      else if (n.alarm === false) hooks.toast('🕵️ Alarm rising…');
      if (n.damage) { hooks.toast('💔 Stability -1'); }
      if (n.spread) hooks.toast('☣️ The infection spreads');
    }
    if (res.shielded) hooks.toast('🛡️ Shield used: no attempt lost');
    renderHud();
  }

  function resultFx(res) {
    if (!res?.rewards) return;
    if (res.rewards.coins) coinBurst(q('.an-coins'), res.rewards.coins);
    if (res.rewards.jackpot) accent('jackpot', 2600);
    if (res.rewards.boss) { accent('bonus'); shake(350); }
    renderHud();
  }

  return { renderHud, step, reset, onGuess, resultFx, openShop, openDetours, closeAll };
}
