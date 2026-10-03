import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadLocalTmdbToken } from './tmdb-token.mjs';

test('uses a supplied TMDB token without requiring a local env file', () => {
  const previous = process.env.TMDB_READ_ACCESS_TOKEN;
  process.env.TMDB_READ_ACCESS_TOKEN = '  test-token  ';
  try {
    assert.equal(loadLocalTmdbToken('missing-env-file'), 'test-token');
  } finally {
    if (previous === undefined) delete process.env.TMDB_READ_ACCESS_TOKEN;
    else process.env.TMDB_READ_ACCESS_TOKEN = previous;
  }
});

test('loads the existing local env file when no token is supplied', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'showtime-env-'));
  const previous = process.env.TMDB_READ_ACCESS_TOKEN;
  delete process.env.TMDB_READ_ACCESS_TOKEN;
  t.after(async () => {
    if (previous === undefined) delete process.env.TMDB_READ_ACCESS_TOKEN;
    else process.env.TMDB_READ_ACCESS_TOKEN = previous;
    await rm(directory, { recursive: true, force: true });
  });
  const envFile = path.join(directory, '.env.local');
  await writeFile(envFile, 'TMDB_READ_ACCESS_TOKEN=test-file-token\n');
  assert.equal(loadLocalTmdbToken(envFile), 'test-file-token');
});
