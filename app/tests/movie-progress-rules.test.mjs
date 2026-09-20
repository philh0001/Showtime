import assert from 'node:assert/strict';
import test from 'node:test';

import {
  commitMovieProgressChange,
  createWatchedMovieSnapshot,
  findWatchedMovie,
  formatLocalUkWatchedDate,
  parseMovieProgress,
  setMovieUnwatched,
  setMovieWatched,
} from '../src/services/movie-progress-rules.ts';
import {
  createMovieProgressStorage,
  MOVIE_PROGRESS_KEY,
  MovieProgressUnavailableError,
} from '../src/services/movie-progress-storage.ts';

const batman = {
  movieId: 272,
  title: 'Batman Begins',
  year: '2005',
  posterUrl: 'https://image.tmdb.org/t/p/w500/batman.jpg',
};

test('missing storage and a valid empty array mean no movie progress', () => {
  assert.deepEqual(parseMovieProgress(null), { status: 'available', records: [] });
  assert.deepEqual(parseMovieProgress('[]'), { status: 'available', records: [] });
});

test('invalid top-level movie progress is unavailable rather than empty', () => {
  assert.deepEqual(parseMovieProgress('{broken'), {
    status: 'unavailable',
    reason: 'malformed',
  });
  assert.deepEqual(parseMovieProgress('{}'), {
    status: 'unavailable',
    reason: 'malformed',
  });
});

test('salvages valid movie records and keeps the newest duplicate', () => {
  const stored = JSON.stringify([
    { ...batman, title: ' Old title ', watchedAt: '2026-09-10T10:00:00.000Z' },
    { movieId: 7, title: ' Seven ', year: null, posterUrl: null, watchedAt: '2026-09-13T10:00:00.000Z' },
    { ...batman, title: ' Batman Begins ', posterUrl: null, watchedAt: '2026-09-12T10:00:00.000Z' },
    { ...batman, movieId: 0, watchedAt: '2026-09-14T10:00:00.000Z' },
    { ...batman, movieId: 1.5, watchedAt: '2026-09-14T10:00:00.000Z' },
    { ...batman, title: '   ', watchedAt: '2026-09-14T10:00:00.000Z' },
    { ...batman, year: 2005, watchedAt: '2026-09-14T10:00:00.000Z' },
    { ...batman, posterUrl: 5, watchedAt: '2026-09-14T10:00:00.000Z' },
    { ...batman, watchedAt: '2026-02-30T10:00:00.000Z' },
    null,
  ]);

  assert.deepEqual(parseMovieProgress(stored), {
    status: 'available',
    records: [
      { movieId: 7, title: 'Seven', year: null, posterUrl: null, watchedAt: '2026-09-13T10:00:00.000Z' },
      { ...batman, title: 'Batman Begins', posterUrl: null, watchedAt: '2026-09-12T10:00:00.000Z' },
    ],
  });
});

test('movie updates are immutable, deterministic, and searchable', () => {
  const first = setMovieWatched([], batman, '2026-09-12T10:00:00.000Z');
  const second = setMovieWatched(first, {
    movieId: 7,
    title: 'Seven',
    year: '1995',
    posterUrl: null,
  }, '2026-09-13T10:00:00.000Z');
  const refreshed = setMovieWatched(second, {
    ...batman,
    title: ' Batman Begins ',
    posterUrl: null,
  }, '2026-09-14T10:00:00.000Z');

  assert.equal(first.length, 1);
  assert.deepEqual(refreshed.map((record) => record.movieId), [272, 7]);
  assert.deepEqual(findWatchedMovie(refreshed, 272), {
    ...batman,
    title: 'Batman Begins',
    posterUrl: null,
    watchedAt: '2026-09-14T10:00:00.000Z',
  });
  assert.deepEqual(setMovieUnwatched(refreshed, 272), [refreshed[1]]);
  assert.equal(findWatchedMovie(refreshed, 999), null);
});

test('creates a snapshot from restricted movie detail fields', () => {
  assert.deepEqual(createWatchedMovieSnapshot({
    id: 272,
    title: 'Batman Begins',
    releaseDate: '2005-06-15',
    posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
  }), {
    movieId: 272,
    title: 'Batman Begins',
    year: '2005',
    posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
  });
  assert.equal(createWatchedMovieSnapshot({
    id: 1,
    title: 'Unknown date',
    releaseDate: null,
    posterUrl: null,
  }).year, null);
});

test('formats watched timestamps as device-local UK dates', () => {
  assert.equal(formatLocalUkWatchedDate('2026-09-13T12:00:00.000Z'), '13/09/2026');
  assert.equal(formatLocalUkWatchedDate('not-a-date'), null);
});

test('a failed movie progress write restores the previous snapshot', async () => {
  const previous = [{ ...batman, watchedAt: '2026-09-12T10:00:00.000Z' }];
  const next = [{ ...batman, watchedAt: '2026-09-13T10:00:00.000Z' }];

  assert.deepEqual(await commitMovieProgressChange(previous, async () => next), {
    saved: true,
    records: next,
  });
  assert.deepEqual(await commitMovieProgressChange(previous, async () => {
    throw new Error('write failed');
  }), {
    saved: false,
    records: previous,
  });
});

test('storage reads the versioned key and converts read exceptions to unavailable', async () => {
  const readKeys = [];
  const storage = createMovieProgressStorage({
    getItem: async (key) => {
      readKeys.push(key);
      return '[]';
    },
    setItem: async () => {},
  });

  assert.deepEqual(await storage.load(), { status: 'available', records: [] });
  assert.deepEqual(readKeys, [MOVIE_PROGRESS_KEY]);

  const failing = createMovieProgressStorage({
    getItem: async () => { throw new Error('read failed'); },
    setItem: async () => {},
  });
  assert.deepEqual(await failing.load(), { status: 'unavailable', reason: 'read-error' });
});

test('storage marks watched and unwatched with normalized persistence', async () => {
  let stored = '[]';
  const writes = [];
  const storage = createMovieProgressStorage({
    getItem: async () => stored,
    setItem: async (key, value) => {
      writes.push({ key, value });
      stored = value;
    },
  }, () => '2026-09-13T12:00:00.000Z');

  const watched = await storage.markWatched({ ...batman, title: ' Batman Begins ' });
  assert.deepEqual(watched, [{
    ...batman,
    watchedAt: '2026-09-13T12:00:00.000Z',
  }]);
  assert.deepEqual(writes[0], {
    key: MOVIE_PROGRESS_KEY,
    value: JSON.stringify(watched),
  });

  const unwatched = await storage.markUnwatched(batman.movieId);
  assert.deepEqual(unwatched, []);
  assert.deepEqual(writes[1], {
    key: MOVIE_PROGRESS_KEY,
    value: '[]',
  });
});

test('storage never overwrites malformed data and reports write failures', async () => {
  let malformedWrites = 0;
  const malformed = createMovieProgressStorage({
    getItem: async () => '{broken',
    setItem: async () => { malformedWrites += 1; },
  });

  await assert.rejects(() => malformed.markWatched(batman), MovieProgressUnavailableError);
  await assert.rejects(() => malformed.markUnwatched(batman.movieId), MovieProgressUnavailableError);
  assert.equal(malformedWrites, 0);

  const writeFailure = createMovieProgressStorage({
    getItem: async () => '[]',
    setItem: async () => { throw new Error('disk full'); },
  });
  await assert.rejects(() => writeFailure.markWatched(batman), /disk full/);
});
