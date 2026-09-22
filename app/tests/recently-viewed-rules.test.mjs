import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addRecentlyViewedItem,
  createRecentlyViewedSnapshot,
  parseRecentlyViewed,
} from '../src/services/recently-viewed-rules.ts';
import {
  createRecentlyViewedStorage,
  RECENTLY_VIEWED_KEY,
} from '../src/services/recently-viewed-storage.ts';

const movie = {
  id: 7,
  mediaType: 'Movie',
  title: 'Seven',
  year: '1995',
  posterUrl: 'https://image.tmdb.org/t/p/w500/seven.jpg',
};

test('creates a recently viewed snapshot from restricted detail fields', () => {
  assert.deepEqual(createRecentlyViewedSnapshot({
    id: 44006,
    mediaType: 'TV',
    title: 'Chicago Fire',
    releaseDate: '2012-10-10',
    posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
  }), {
    id: 44006,
    mediaType: 'TV',
    title: 'Chicago Fire',
    year: '2012',
    posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
  });
  assert.equal(createRecentlyViewedSnapshot({
    id: 1,
    mediaType: 'Movie',
    title: 'Unknown date',
    releaseDate: null,
    posterUrl: null,
  }).year, null);
});

test('missing storage and a valid empty array mean no recently viewed titles', () => {
  assert.deepEqual(parseRecentlyViewed(null), { status: 'available', items: [] });
  assert.deepEqual(parseRecentlyViewed('[]'), { status: 'available', items: [] });
});

test('invalid top-level storage is unavailable rather than empty', () => {
  assert.deepEqual(parseRecentlyViewed('{broken'), {
    status: 'unavailable',
    reason: 'malformed',
  });
  assert.deepEqual(parseRecentlyViewed('{}'), {
    status: 'unavailable',
    reason: 'malformed',
  });
});

test('salvages valid records, preserves media-type identity, and keeps the newest duplicate', () => {
  const stored = JSON.stringify([
    { ...movie, title: ' Old title ', viewedAt: '2026-09-10T10:00:00.000Z' },
    { ...movie, mediaType: 'TV', title: ' TV Seven ', viewedAt: '2026-09-12T10:00:00.000Z' },
    { ...movie, title: ' Seven ', posterUrl: null, viewedAt: '2026-09-13T10:00:00.000Z' },
    { ...movie, id: 0, viewedAt: '2026-09-14T10:00:00.000Z' },
    { ...movie, mediaType: 'Person', viewedAt: '2026-09-14T10:00:00.000Z' },
    { ...movie, title: '   ', viewedAt: '2026-09-14T10:00:00.000Z' },
    { ...movie, viewedAt: '2026-02-30T10:00:00.000Z' },
    null,
  ]);

  assert.deepEqual(parseRecentlyViewed(stored), {
    status: 'available',
    items: [
      { ...movie, title: 'Seven', posterUrl: null, viewedAt: '2026-09-13T10:00:00.000Z' },
      { ...movie, mediaType: 'TV', title: 'TV Seven', viewedAt: '2026-09-12T10:00:00.000Z' },
    ],
  });
});

test('reopening a title replaces its fields, moves it first, and retains only twenty items', () => {
  const items = Array.from({ length: 20 }, (_, index) => ({
    id: index + 1,
    mediaType: 'Movie',
    title: `Movie ${index + 1}`,
    year: '2026',
    posterUrl: null,
    viewedAt: new Date(Date.UTC(2026, 8, index + 1)).toISOString(),
  }));

  const added = addRecentlyViewedItem(items, {
    id: 21,
    mediaType: 'TV',
    title: 'New show',
    year: null,
    posterUrl: null,
  }, '2026-09-21T12:00:00.000Z');
  assert.equal(added.length, 20);
  assert.equal(added[0].id, 21);
  assert.equal(added.some((item) => item.id === 1 && item.mediaType === 'Movie'), false);

  const reopened = addRecentlyViewedItem(added, {
    id: 7,
    mediaType: 'Movie',
    title: 'Updated Seven',
    year: '1995',
    posterUrl: 'https://image.tmdb.org/t/p/w500/updated.jpg',
  }, '2026-09-22T12:00:00.000Z');
  assert.deepEqual(reopened[0], {
    id: 7,
    mediaType: 'Movie',
    title: 'Updated Seven',
    year: '1995',
    posterUrl: 'https://image.tmdb.org/t/p/w500/updated.jpg',
    viewedAt: '2026-09-22T12:00:00.000Z',
  });
  assert.equal(reopened.filter((item) => item.id === 7 && item.mediaType === 'Movie').length, 1);
});

test('storage reads the versioned key and converts read exceptions to unavailable', async () => {
  const readKeys = [];
  const storage = createRecentlyViewedStorage({
    getItem: async (key) => {
      readKeys.push(key);
      return '[]';
    },
    setItem: async () => {},
  });

  assert.deepEqual(await storage.load(), { status: 'available', items: [] });
  assert.deepEqual(readKeys, [RECENTLY_VIEWED_KEY]);

  const failing = createRecentlyViewedStorage({
    getItem: async () => { throw new Error('read failed'); },
    setItem: async () => {},
  });
  assert.deepEqual(await failing.load(), { status: 'unavailable', reason: 'read-error' });
});

test('record writes normalized JSON using the injected timestamp', async () => {
  let savedKey = '';
  let savedValue = '';
  const storage = createRecentlyViewedStorage({
    getItem: async () => '[]',
    setItem: async (key, value) => {
      savedKey = key;
      savedValue = value;
    },
  }, () => '2026-09-13T12:00:00.000Z');

  const items = await storage.record({ ...movie, title: ' Seven ' });

  assert.equal(savedKey, RECENTLY_VIEWED_KEY);
  assert.deepEqual(JSON.parse(savedValue), items);
  assert.deepEqual(items, [{
    ...movie,
    title: 'Seven',
    viewedAt: '2026-09-13T12:00:00.000Z',
  }]);
});

test('record never overwrites malformed storage and reports write failures', async () => {
  let malformedWrites = 0;
  const malformed = createRecentlyViewedStorage({
    getItem: async () => '{broken',
    setItem: async () => { malformedWrites += 1; },
  });

  await assert.rejects(() => malformed.record(movie));
  assert.equal(malformedWrites, 0);

  const writeFailure = createRecentlyViewedStorage({
    getItem: async () => '[]',
    setItem: async () => { throw new Error('disk full'); },
  });
  await assert.rejects(() => writeFailure.record(movie), /disk full/);
});
