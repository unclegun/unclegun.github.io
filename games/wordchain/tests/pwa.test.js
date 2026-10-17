import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');
const walk = (d) => readdirSync(join(root, d)).flatMap((n) => { const p = `${d}/${n}`; return statSync(join(root, p)).isDirectory() ? walk(p) : [p]; });

test('manifest is installable and strictly scoped to this folder with relative paths', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.display, 'standalone');
  assert.equal(m.scope, './');
  assert.ok(m.start_url.startsWith('./') && !m.start_url.startsWith('/'));
  assert.ok(m.name && m.short_name && m.theme_color && m.background_color);
  assert.ok(m.icons.some((i) => i.sizes === '192x192') && m.icons.some((i) => i.sizes === '512x512') && m.icons.some((i) => i.purpose === 'maskable'));
  for (const i of m.icons) { assert.ok(!i.src.startsWith('/')); assert.ok(existsSync(join(root, i.src)), i.src); }
  assert.match(read('index.html'), /rel="manifest" href="manifest.webmanifest"/);
});

test('service worker precaches every runtime asset and only manages wordchain caches', () => {
  const sw = read('sw.js');
  const listed = new Set([...sw.match(/const PRECACHE = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
  const assets = [...walk('js'), ...walk('css'), ...walk('icons'), ...walk('data').filter((f) => f.endsWith('.txt') && !/exclusions/.test(f)), 'index.html', 'manifest.webmanifest'];
  for (const a of assets) assert.ok(listed.has(a), `${a} is missing from the precache list`);
  for (const l of listed) if (l !== './') assert.ok(existsSync(join(root, l)), `${l} does not exist`);
  assert.match(sw, /k\.startsWith\('wordchain-'\)/);
  assert.doesNotMatch(sw, /skipWaiting\(\)\s*;?\s*\n\}\);\s*\nself\.addEventListener\('activate'/, 'no automatic skipWaiting on install');
  assert.match(sw, /const VERSION = '/);
});
