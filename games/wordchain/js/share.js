import { cellsOf } from './placementValidator.js';

/** Shareable end-of-run results. Pure helpers + thin browser wrappers; independent of the game engine. */

/** Clean standalone SVG of the finished crossword. `words` = [{ word, x, y, dir }]. */
export function buildCrosswordSvg(words, { cell = 32, pad = 16, title = 'WordChain' } = {}) {
  const cells = new Map();
  for (const w of words) for (const c of cellsOf(w.word, w.x, w.y, w.dir)) cells.set(c.x + ',' + c.y, c);
  if (!cells.size) return `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>`;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of cells.values()) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y); }
  const w = (x1 - x0 + 1) * cell + pad * 2;
  const h = (y1 - y0 + 1) * cell + pad * 2;
  const rects = [...cells.values()].map((c) => {
    const px = pad + (c.x - x0) * cell, py = pad + (c.y - y0) * cell;
    return `<rect x="${px + 1}" y="${py + 1}" width="${cell - 2}" height="${cell - 2}" rx="4" fill="#2e7d32"/>` +
      `<text x="${px + cell / 2}" y="${py + cell / 2 + 1}" text-anchor="middle" dominant-baseline="central" ` +
      `font-family="system-ui,Segoe UI,Roboto,sans-serif" font-weight="700" font-size="${Math.round(cell * 0.55)}" fill="#fff">${c.letter.toUpperCase()}</text>`;
  }).join('');
  const safeTitle = String(title).replace(/[<>&"]/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${safeTitle} crossword">` +
    `<rect width="100%" height="100%" rx="10" fill="#fafafa"/>${rects}</svg>`;
}

/** Emoji picture of the crossword (🟩 letter cell, ⬛ empty). Empty string if it would be unreasonably large. */
export function buildShareGrid(words, { maxSize = 24 } = {}) {
  const cells = new Set();
  for (const w of words) for (const c of cellsOf(w.word, w.x, w.y, w.dir)) cells.add(c.x + ',' + c.y);
  if (!cells.size) return '';
  const pts = [...cells].map((k) => k.split(',').map(Number));
  const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]));
  const y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
  if (x1 - x0 + 1 > maxSize || y1 - y0 + 1 > maxSize) return '';
  const rows = [];
  for (let y = y0; y <= y1; y++) {
    let row = '';
    for (let x = x0; x <= x1; x++) row += cells.has(x + ',' + y) ? '🟩' : '⬛';
    rows.push(row);
  }
  return rows.join('\n');
}

export function buildShareText({ words, score, best, isBest, url = '', mode = '', grid = '' }) {
  const lines = [`WordChain${mode ? ' ' + mode : ''}: ${words} word${words === 1 ? '' : 's'} solved, score ${score}`];
  if (best > 0) lines.push(isBest ? `New best score: ${best}!` : `Best score: ${best}`);
  if (grid) lines.push(grid);
  if (url) lines.push(url);
  return lines.join('\n');
}

const svgFile = (svg) => new File([svg], 'wordchain-crossword.svg', { type: 'image/svg+xml' });

export function downloadSvg(svg, doc = document) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const a = doc.createElement('a');
  a.href = url;
  a.download = 'wordchain-crossword.svg';
  doc.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Web Share (with the SVG file when supported) -> clipboard text -> SVG download.
 * Resolves to 'shared' | 'copied' | 'downloaded' | 'cancelled'.
 */
export async function shareResult({ svg, text, nav = globalThis.navigator }) {
  try {
    if (nav?.share) {
      const data = { title: 'WordChain', text };
      if (typeof File !== 'undefined' && nav.canShare?.({ files: [svgFile(svg)] })) data.files = [svgFile(svg)];
      await nav.share(data);
      return 'shared';
    }
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancelled';
  }
  try {
    await nav.clipboard.writeText(text);
    return 'copied';
  } catch { /* fall through */ }
  downloadSvg(svg);
  return 'downloaded';
}
