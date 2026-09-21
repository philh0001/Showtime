import assert from 'node:assert/strict';
import test from 'node:test';

import { createSyncEngine } from '../src/services/sync-engine.ts';

const film = (id) => ({ id, mediaType: 'Movie', title: `Film ${id}`, year: null, posterUrl: null });

function memoryStorage(initial = {}) {
  const entries = new Map(Object.entries(initial));
  return {
    getItem: async (key) => entries.get(key) ?? null,
    setItem: async (key, value) => { entries.set(key, value); },
    removeItem: async (key) => { entries.delete(key); },
  };
}

function remote(initial = null) {
  let entry = initial && { data: structuredClone(initial), revision: 1, updatedAt: '2026-01-01T00:00:00.000Z' };
  let failPush = false;
  let beforePush = null;
  return {
    get data() { return entry?.data; },
    get revision() { return entry?.revision; },
    failNextPush() { failPush = true; },
    beforeNextPush() { beforePush = true; },
    async pull() { return { ok: true, status: 200, body: { collections: entry ? { watchlist: structuredClone(entry) } : {} } }; },
    async push(_token, _collection, data, expectedRevision) {
      if (beforePush) { beforePush = null; entry = { data: [film(1), film(3)], revision: 2, updatedAt: '2026-01-02T00:00:00.000Z' }; }
      if (failPush) { failPush = false; return { ok: false, status: 503, body: { error: 'Temporarily unavailable.' } }; }
      if ((entry?.revision ?? null) !== expectedRevision) return { ok: false, status: 409, body: { error: 'Conflict.' } };
      entry = { data: structuredClone(data), revision: (entry?.revision ?? 0) + 1, updatedAt: '2026-01-03T00:00:00.000Z' };
      return { ok: true, status: 200, body: { revision: entry.revision, updatedAt: entry.updatedAt } };
    },
  };
}

test('first account sync merges guest and cloud titles, then propagates a later removal', async () => {
  const storage = memoryStorage({ watchlist: JSON.stringify([film(1)]) });
  const api = remote([film(2)]);
  const sync = createSyncEngine(storage, api, { watchlist: 'watchlist' });
  assert.equal((await sync.run('token', 'user-1')).ok, true);
  assert.deepEqual(JSON.parse(await storage.getItem('watchlist')), [film(1), film(2)]);
  assert.deepEqual(api.data, [film(1), film(2)]);
  await storage.setItem('watchlist', JSON.stringify([film(2)]));
  assert.equal((await sync.run('token', 'user-1')).ok, true);
  assert.deepEqual(api.data, [film(2)]);
});

test('a stale push retries against the latest cloud revision without dropping either edit', async () => {
  const storage = memoryStorage({ watchlist: JSON.stringify([film(1)]) });
  const api = remote([film(1)]);
  const sync = createSyncEngine(storage, api, { watchlist: 'watchlist' });
  assert.equal((await sync.run('token', 'user-1')).ok, true);
  await storage.setItem('watchlist', JSON.stringify([film(1), film(2)]));
  api.beforeNextPush();
  assert.equal((await sync.run('token', 'user-1')).ok, true);
  assert.deepEqual(api.data, [film(1), film(2), film(3)]);
  assert.deepEqual(JSON.parse(await storage.getItem('watchlist')), [film(1), film(2), film(3)]);
});

test('failed upload reports failure and preserves local edits for retry', async () => {
  const storage = memoryStorage({ watchlist: JSON.stringify([film(1)]) });
  const api = remote();
  const sync = createSyncEngine(storage, api, { watchlist: 'watchlist' });
  api.failNextPush();
  const failed = await sync.run('token', 'user-1');
  assert.deepEqual(failed, { ok: false, error: 'Temporarily unavailable.' });
  assert.deepEqual(JSON.parse(await storage.getItem('watchlist')), [film(1)]);
  assert.equal(api.data, undefined);
  assert.equal((await sync.run('token', 'user-1')).ok, true);
  assert.deepEqual(api.data, [film(1)]);
});

test('malformed local data is never replaced or uploaded', async () => {
  const storage = memoryStorage({ watchlist: '{broken' });
  const api = remote([film(2)]);
  const result = await createSyncEngine(storage, api, { watchlist: 'watchlist' }).run('token', 'user-1');
  assert.equal(result.ok, false);
  assert.equal(await storage.getItem('watchlist'), '{broken');
  assert.deepEqual(api.data, [film(2)]);
});

test('a stored JSON null is treated as unreadable rather than an empty library', async () => {
  const storage = memoryStorage({ watchlist: 'null' });
  const api = remote([film(2)]);
  const result = await createSyncEngine(storage, api, { watchlist: 'watchlist' }).run('token', 'user-1');
  assert.equal(result.ok, false);
  assert.equal(await storage.getItem('watchlist'), 'null');
});

test('malformed episode progress stays local and is not uploaded', async () => {
  const broken = [{ tvId: 8, trackableSeasonNumbers: [1], watchedSeasonNumbers: [], episodeProgress: [{
    seasonNumber: 1, knownEpisodeNumbers: [1], trackableEpisodeNumbers: [1], watchedEpisodeNumbers: 'broken',
  }] }];
  const storage = memoryStorage({ television: JSON.stringify(broken) });
  const api = remote();
  const result = await createSyncEngine(storage, api, { 'tv-progress': 'television' }).run('token', 'user-1');
  assert.equal(result.ok, false);
  assert.equal(await storage.getItem('television'), JSON.stringify(broken));
  assert.equal(api.data, undefined);
});

test('a second device restores account data and sends its changes back to the first', async () => {
  const api = remote();
  const firstStorage = memoryStorage({ watchlist: JSON.stringify([film(1)]) });
  const secondStorage = memoryStorage();
  const first = createSyncEngine(firstStorage, api, { watchlist: 'watchlist' });
  const second = createSyncEngine(secondStorage, api, { watchlist: 'watchlist' });
  assert.equal((await first.run('first-token', 'same-account')).ok, true);
  assert.equal((await second.run('second-token', 'same-account')).ok, true);
  assert.deepEqual(JSON.parse(await secondStorage.getItem('watchlist')), [film(1)]);
  await secondStorage.setItem('watchlist', JSON.stringify([film(1), film(2)]));
  assert.equal((await second.run('second-token', 'same-account')).ok, true);
  assert.equal((await first.run('first-token', 'same-account')).ok, true);
  assert.deepEqual(JSON.parse(await firstStorage.getItem('watchlist')), [film(1), film(2)]);
});

test('registration merges guest films and TV episodes with an existing account for a clean device', async () => {
  const watchedMovie = (id) => ({ movieId: id, title: `Film ${id}`, year: null,
    posterUrl: null, watchedAt: '2026-01-01T00:00:00.000Z' });
  const show = (episodes) => [{ tvId: 10, trackableSeasonNumbers: [1], watchedSeasonNumbers: [],
    episodeProgress: [{ seasonNumber: 1, knownEpisodeNumbers: [1, 2],
      trackableEpisodeNumbers: [1, 2], watchedEpisodeNumbers: episodes }] }];
  const cloud = new Map(Object.entries({
    watchlist: [film(2)], 'movie-progress': [watchedMovie(2)], 'tv-progress': show([1]),
  }).map(([name, data]) => [name, { data, revision: 1, updatedAt: '2026-01-01T00:00:00.000Z' }]));
  const api = {
    async pull() { return { ok: true, status: 200, body: { collections: Object.fromEntries(
      [...cloud].map(([name, entry]) => [name, structuredClone(entry)]),
    ) } }; },
    async push(_token, name, data, expectedRevision) {
      const previous = cloud.get(name);
      if ((previous?.revision ?? null) !== expectedRevision) return { ok: false, status: 409, body: {} };
      const next = { data: structuredClone(data), revision: (previous?.revision ?? 0) + 1,
        updatedAt: '2026-01-02T00:00:00.000Z' };
      cloud.set(name, next);
      return { ok: true, status: 200, body: next };
    },
  };
  const guestStorage = memoryStorage({
    watchlist: JSON.stringify([film(1)]),
    movies: JSON.stringify([watchedMovie(1)]),
    television: JSON.stringify(show([2])),
  });
  const keys = { watchlist: 'watchlist', 'movie-progress': 'movies', 'tv-progress': 'television' };
  assert.equal((await createSyncEngine(guestStorage, api, keys).run('verified-token', 'account')).ok, true);
  const secondStorage = memoryStorage();
  assert.equal((await createSyncEngine(secondStorage, api, keys).run('second-token', 'account')).ok, true);
  assert.deepEqual(JSON.parse(await secondStorage.getItem('watchlist')), [film(1), film(2)]);
  assert.deepEqual(JSON.parse(await secondStorage.getItem('movies')), [watchedMovie(1), watchedMovie(2)]);
  assert.deepEqual(JSON.parse(await secondStorage.getItem('television'))[0].episodeProgress[0].watchedEpisodeNumbers, [1, 2]);
});
