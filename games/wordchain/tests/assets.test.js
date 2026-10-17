import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (relative) => readdirSync(join(root, relative)).flatMap((name) => {
  const path = `${relative}/${name}`;
  return statSync(join(root, path)).isDirectory() ? walk(path) : [path];
});

test('all local JavaScript module imports resolve to shipped assets', () => {
  for (const file of walk('js').filter((path) => path.endsWith('.js'))) {
    const source = readFileSync(join(root, file), 'utf8');
    const imports = source.matchAll(/\b(?:import|export)\s+(?:[^'"]*?\s+from\s*)?['"]([^'"]+)['"]/g);
    for (const [, specifier] of imports) {
      if (!specifier.startsWith('.')) continue;
      assert.ok(statSync(resolve(root, dirname(file), specifier), { throwIfNoEntry: false })?.isFile(), `${file} imports missing asset ${specifier}`);
    }
  }
});
