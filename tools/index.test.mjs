import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildIndex } from './index.mjs';

const here = new URL('..', import.meta.url).pathname;
const registry = (files) => {
  const root = mkdtempSync(join(tmpdir(), 'registry-'));
  for (const [path, from] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    if (typeof from === 'string') copyFileSync(join(here, from), join(root, path)); else writeFileSync(join(root, path), from);
  }
  return root;
};

test('the samples list, newest version first, with the fork naming its origin', async () => {
  const { index, errors } = await buildIndex(here);
  assert.deepEqual(errors, []);
  const tally = index.apps.find((a) => a.id === 'tally');
  assert.equal(tally.version, '1.1.0');
  assert.deepEqual(tally.versions, ['1.1.0', '1.0.0']);
  assert.deepEqual(index.apps.find((a) => a.id === 'tally-fork').forked_from, { id: 'tally', version: '1.1.0' });
});

test('an app in the wrong folder, misnamed, or without what a listing needs is refused', async () => {
  const { index, errors } = await buildIndex(registry({
    'apps/counter/tally-1.1.0.tapp': 'apps/tally/tally-1.1.0.tapp',
    'apps/tally/tally.tapp': 'apps/tally/tally-1.1.0.tapp',
    'apps/junk/junk-1.0.0.tapp': new TextEncoder().encode('not a zip'),
  }));
  assert.equal(index.apps.length, 0);
  assert.match(errors.join('\n'), /the folder is "counter"/);
  assert.match(errors.join('\n'), /name it tally-1.1.0.tapp/);
  assert.match(errors.join('\n'), /not a zip/);
});
