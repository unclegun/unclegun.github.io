/**
 * ThemeDirector: curated, subdued palettes for Anarchy. The palette for a run position is a pure function of
 * (seed, solved words), so it restores deterministically after save/resume and never repeats back-to-back.
 * Palettes only define decorative variables; Wordle feedback colours (--correct/--present/--absent) are never touched.
 */
export const THEMES = [
  { id: 'slate', name: 'Slate', dark: false, vars: { bg: '#e9edf2', panel: '#f6f8fb', panel2: '#dde4ec', fg: '#1d2733', muted: '#4c5a6a', line: '#b9c4d0', accent: '#2c5f9e', tint: '#5d7fa8' } },
  { id: 'teal', name: 'Muted Teal', dark: false, vars: { bg: '#e3f0ee', panel: '#f3faf9', panel2: '#d2e6e3', fg: '#14302d', muted: '#40605c', line: '#a9c9c4', accent: '#1d7a73', tint: '#4f9d95' } },
  { id: 'violet', name: 'Dusty Violet', dark: false, vars: { bg: '#ece8f2', panel: '#f8f6fb', panel2: '#ded8e8', fg: '#2a2236', muted: '#5b5069', line: '#c3bad1', accent: '#6b4fa0', tint: '#8f7bb5' } },
  { id: 'amber', name: 'Warm Amber', dark: false, vars: { bg: '#f4ecdc', panel: '#fcf8ee', panel2: '#ebdfc6', fg: '#33270f', muted: '#675637', line: '#d4c29b', accent: '#8f5a00', tint: '#c2903a' } },
  { id: 'sage', name: 'Sage Green', dark: false, vars: { bg: '#e8eee2', panel: '#f6f9f2', panel2: '#d9e3d0', fg: '#222f1c', muted: '#4e5f45', line: '#b8c8aa', accent: '#44702f', tint: '#7a9f68' } },
  { id: 'coral', name: 'Muted Coral', dark: false, vars: { bg: '#f5e6e1', panel: '#fcf5f2', panel2: '#ecd4cc', fg: '#35201b', muted: '#6c4a42', line: '#d8b8ae', accent: '#a8452f', tint: '#cd7d6a' } },
  { id: 'indigo', name: 'Deep Indigo', dark: true, vars: { bg: '#141733', panel: '#1d2147', panel2: '#272c5a', fg: '#eceefc', muted: '#b4b9e0', line: '#3d437a', accent: '#9aa8ff', tint: '#4a55b5' } },
  { id: 'rose', name: 'Soft Rose', dark: false, vars: { bg: '#f4e4ea', panel: '#fcf4f7', panel2: '#ead2db', fg: '#34202a', muted: '#6a4856', line: '#d8b5c3', accent: '#a23b63', tint: '#c97a98' } },
  { id: 'graphite', name: 'Cool Graphite', dark: true, vars: { bg: '#17191c', panel: '#202327', panel2: '#2b2f34', fg: '#eef0f2', muted: '#b3b8be', line: '#41464d', accent: '#8bb4e8', tint: '#5a6672' } },
];

const STRIDES = [2, 4, 5, 7, 8]; // coprime with 9: visits every palette before repeating

export function themeIndex(seed, solved) {
  const s = (seed >>> 0) % 997;
  const start = s % THEMES.length;
  const stride = STRIDES[Math.floor(s / THEMES.length) % STRIDES.length];
  return (start + stride * Math.max(0, solved)) % THEMES.length;
}

export const themeFor = (seed, solved) => THEMES[themeIndex(seed, solved)];

/** Relative luminance contrast ratio between two hex colours. */
export function contrast(a, b) {
  const lum = (hex) => {
    const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Applies a palette to `root` via CSS custom properties; `clear` removes it (Classic and other modes). */
export function applyTheme(root, theme) {
  const v = theme.vars;
  const set = (k, val) => root.style.setProperty(k, val);
  set('--an-bg', v.bg); set('--an-panel', v.panel); set('--an-panel2', v.panel2); set('--an-fg', v.fg);
  set('--an-muted', v.muted); set('--an-line', v.line); set('--an-accent', v.accent); set('--an-tint', v.tint);
  root.dataset.anTheme = theme.id;
}

export function clearTheme(root) {
  for (const k of ['bg', 'panel', 'panel2', 'fg', 'muted', 'line', 'accent', 'tint']) root.style.removeProperty(`--an-${k}`);
  delete root.dataset.anTheme;
}
