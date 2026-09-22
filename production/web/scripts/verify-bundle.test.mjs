import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { verifyBundle } from './verify-bundle.mjs';

async function fixture(source) {
  const root = await mkdtemp(join(tmpdir(), 'showtime-bundle-'));
  const scripts = join(root, '_expo', 'static', 'js', 'web');
  await mkdir(scripts, { recursive: true });
  await writeFile(join(scripts, 'entry.js'), source);
  return root;
}

test('accepts a generated browser bundle with the canonical API URL', async () => {
  const root = await fixture('const api = "https://api.showtimetracker.show";');
  await assert.doesNotReject(verifyBundle(root));
});

test('rejects a bundle without the canonical API URL', async () => {
  const root = await fixture('const api = "https://somewhere.example";');
  await assert.rejects(verifyBundle(root), /canonical API URL/);
});

test('rejects local endpoints, old API hosts and credential patterns', async () => {
  for (const disallowed of [
    'http://localhost:3001',
    'https://showtime-api.showtime-workers.workers.dev',
    'TMDB_READ_ACCESS_TOKEN',
    'TMDB_API_KEY',
    'api_key=private',
  ]) {
    const root = await fixture(`"https://api.showtimetracker.show"; "${disallowed}";`);
    await assert.rejects(verifyBundle(root), /forbidden bundle content/);
  }
});
