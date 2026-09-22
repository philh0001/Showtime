import assert from 'node:assert/strict';
import test from 'node:test';
import { createDiscoveryCache } from '../src/services/discovery-cache.ts';

const data = { movies: [{ id: 1, title: 'Movie', mediaType: 'Movie', year: null, posterUrl: null }], tv: [] };

test('discovery coalesces concurrent loads, caches success and refreshes after expiry', async () => {
  let reads = 0;
  let now = 0;
  const cache = createDiscoveryCache(async () => { reads += 1; return data; }, () => now);
  const results = await Promise.all([cache.load(), cache.load()]);
  assert.equal(reads, 1);
  assert.deepEqual(results[0], { ...data, stale: false });
  await cache.load();
  assert.equal(reads, 1);
  now = 31 * 60 * 1000;
  await cache.load();
  assert.equal(reads, 2);
});

test('offline refresh preserves previous discovery and backs off until retry', async () => {
  let now = 0;
  let offline = false;
  let reads = 0;
  const cache = createDiscoveryCache(async () => {
    reads += 1;
    if (offline) throw new Error('offline');
    return data;
  }, () => now);
  await cache.load();
  now = 31 * 60 * 1000;
  offline = true;
  assert.deepEqual(await cache.load(), { ...data, stale: true });
  await cache.load();
  assert.equal(reads, 2);
  offline = false;
  assert.equal((await cache.load(true)).stale, false);
  assert.equal(reads, 3);
});

test('first-load network errors and malformed payloads are rejected', async () => {
  const cache = createDiscoveryCache(async () => ({ movies: [{ id: -1 }], tv: [] }));
  await assert.rejects(cache.load());
  await assert.rejects(createDiscoveryCache(async () => { throw new Error('offline'); }).load());
});
