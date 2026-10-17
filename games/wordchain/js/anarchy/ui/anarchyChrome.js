import { applyTheme, clearTheme } from '../themeDirector.js';
import { AudioDirector } from '../audioDirector.js';
import { PlaytestMetrics } from '../playtestMetrics.js';
import { reduceMotion } from './dom.js';

/**
 * Wires the Anarchy-only theme, music controls and local metrics to the page.
 * Everything is a no-op outside Anarchy: leave() clears the palette and stops the music.
 */
export function createAnarchyChrome({ doc = document, audio = new AudioDirector(), metrics = new PlaytestMetrics() } = {}) {
  const root = doc.documentElement;
  const $ = (id) => doc.getElementById(id);
  let lastTheme = null;
  let popTimer = null;

  function syncAudioUI() {
    const p = audio.prefs;
    const btn = $('an-music');
    if (!btn) return;
    btn.textContent = audio.playing ? '🎵 Music on' : p.music ? '🎵 Tap to resume music' : '🎵 Enable music';
    btn.setAttribute('aria-pressed', String(audio.playing));
    $('an-volume').value = String(Math.round(p.volume * 100));
    $('an-sfx').checked = p.sfx;
  }
  audio.onChange = syncAudioUI;

  $('an-music')?.addEventListener('click', () => audio.setMusic(!audio.playing)); // user gesture: the only way audio starts
  $('an-volume')?.addEventListener('input', (e) => audio.setVolume(e.target.value / 100));
  $('an-sfx')?.addEventListener('change', (e) => audio.setSfx(e.target.checked));
  $('an-stats')?.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([metrics.exportJSON()], { type: 'application/json' }));
    const a = Object.assign(doc.createElement('a'), { href: url, download: 'wordchain-anarchy-stats.json' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  doc.addEventListener('visibilitychange', () => audio.hidden(doc.hidden));
  syncAudioUI();

  return {
    audio, metrics,
    /** Applies the palette for the current run position; a short success accent plays only when it changed. */
    sync(game) {
      const t = game.theme;
      applyTheme(root, t);
      if (lastTheme && lastTheme !== t.id && !reduceMotion()) {
        root.classList.add('an-theme-pop');
        clearTimeout(popTimer);
        popTimer = setTimeout(() => root.classList.remove('an-theme-pop'), 1000);
      }
      lastTheme = t.id;
      audio.setChaos(game.chaos.value / 100);
    },
    leave() {
      clearTheme(root);
      root.classList.remove('an-theme-pop');
      clearTimeout(popTimer);
      lastTheme = null;
      audio.stop();
      syncAudioUI();
    },
  };
}
