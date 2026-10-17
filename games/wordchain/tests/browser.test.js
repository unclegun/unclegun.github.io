import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawnSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain' };
const chrome = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'].map((b) => spawnSync('which', [b]).stdout?.toString().trim()).find(Boolean) || process.env.CHROME_BIN;

/** Real-browser test: needs a local Chromium (skipped otherwise). Drives the real HUD buttons and shop in headless Chrome. */
test('HUD buttons, shop purchases and inventory work in a real browser', { skip: !chrome || !existsSync(chrome) ? 'no Chromium available' : false }, async () => {
  const server = createServer(async (req, res) => {
    try {
      const path = normalize(join(root, decodeURIComponent(req.url.split('?')[0])));
      if (!path.startsWith(root + sep)) throw new Error('outside root');
      res.setHeader('content-type', TYPES[extname(path)] || 'application/octet-stream');
      res.end(await readFile(path));
    } catch { res.statusCode = 404; res.end(); }
  }).listen(0);
  try {
    const port = server.address().port;
    // async spawn: the in-process static server must keep serving while Chromium loads the page
    const r = await promisify(execFile)(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--virtual-time-budget=15000', '--dump-dom', `http://127.0.0.1:${port}/tests/browser/hud.html`], { encoding: 'utf8', timeout: 60000, maxBuffer: 1 << 24 });
    const m = r.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    assert.ok(m, `page rendered: ${r.stderr.slice(0, 300)}`);
    const out = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
    assert.deepEqual(out.errors, []);
    for (const [name, ok] of Object.entries(out.checks)) assert.ok(ok, `check failed: ${name}`);
    assert.ok(Object.keys(out.checks).length >= 14);
  } finally { server.close(); }
});
