import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterWatchlistItems,
  getWatchlistProgressLabel,
  getWatchlistStatus,
  loadWatchlistProgressData,
} from '../src/services/watchlist-progress.ts';

const tvItems = [1, 2, 3].map((id) => ({
  id, mediaType: 'TV', title: `Show ${id}`, year: '2026', posterUrl: null,
}));

const movieItems = [
  { id: 272, mediaType: 'Movie', title: 'Batman Begins', year: '2005', posterUrl: null },
  { id: 7, mediaType: 'Movie', title: 'Seven', year: '1995', posterUrl: null },
];

test('loads Watchlist and both progress collections once regardless of item count', async () => {
  let watchlistReads = 0;
  let tvProgressReads = 0;
  let movieProgressReads = 0;
  let networkCalls = 0;
  const data = await loadWatchlistProgressData({
    loadWatchlist: async () => {
      watchlistReads += 1;
      return tvItems;
    },
    loadTvProgress: async () => {
      tvProgressReads += 1;
      return { status: 'available', records: [
        { tvId: 1, trackableSeasonNumbers: [1, 2], watchedSeasonNumbers: [1], episodeProgress: [] },
      ] };
    },
    loadMovieProgress: async () => {
      movieProgressReads += 1;
      return { status: 'available', records: [] };
    },
  });

  assert.equal(data.items.length, 3);
  assert.equal(watchlistReads, 1);
  assert.equal(tvProgressReads, 1);
  assert.equal(movieProgressReads, 1);
  assert.equal(networkCalls, 0);
});

test('keeps Watchlist available when either progress read rejects', async () => {
  const tvFailure = await loadWatchlistProgressData({
    loadWatchlist: async () => movieItems,
    loadTvProgress: async () => { throw new Error('TV read failed'); },
    loadMovieProgress: async () => ({ status: 'available', records: [] }),
  });
  assert.deepEqual(tvFailure, {
    items: movieItems,
    tvProgress: { status: 'unavailable', reason: 'read-error' },
    movieProgress: { status: 'available', records: [] },
  });

  const movieFailure = await loadWatchlistProgressData({
    loadWatchlist: async () => tvItems,
    loadTvProgress: async () => ({ status: 'available', records: [] }),
    loadMovieProgress: async () => { throw new Error('movie read failed'); },
  });
  assert.deepEqual(movieFailure, {
    items: tvItems,
    tvProgress: { status: 'available', records: [] },
    movieProgress: { status: 'unavailable', reason: 'read-error' },
  });

  await assert.rejects(() => loadWatchlistProgressData({
    loadWatchlist: async () => { throw new Error('Watchlist failed'); },
    loadTvProgress: async () => ({ status: 'available', records: [] }),
    loadMovieProgress: async () => ({ status: 'available', records: [] }),
  }), /Watchlist failed/);
});

test('builds local progress, missing-record, unavailable, and movie labels', () => {
  const available = { status: 'available', records: [
    { tvId: 1, trackableSeasonNumbers: [1, 2, 3], watchedSeasonNumbers: [1, 9], episodeProgress: [] },
  ] };
  const movie = { ...tvItems[0], mediaType: 'Movie' };

  assert.equal(getWatchlistProgressLabel(tvItems[0], available), '1 of 3 seasons watched');
  assert.equal(getWatchlistProgressLabel(tvItems[1], available), 'Open details to load season progress');
  assert.equal(getWatchlistProgressLabel(tvItems[0], { status: 'unavailable', reason: 'read-error' }), 'Season progress unavailable');
  assert.equal(getWatchlistProgressLabel(movie, available), null);
});

test('adds newest-season aired-episode progress without a network request', () => {
  const progress = { status: 'available', records: [{
    tvId: 1,
    trackableSeasonNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    watchedSeasonNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    episodeProgress: [{
      seasonNumber: 15,
      knownEpisodeNumbers: [1, 2, 3, 4, 5],
      trackableEpisodeNumbers: [1, 2, 3, 4],
      watchedEpisodeNumbers: [1, 2, 3, 99],
    }],
  }] };

  assert.equal(
    getWatchlistProgressLabel(tvItems[0], progress),
    '14 of 15 seasons watched · S15: 3 of 4 aired episodes watched',
  );
});

test('classifies movie and TV Watchlist status from local progress', () => {
  const movieProgress = { status: 'available', records: [{
    movieId: 272,
    title: 'Batman Begins',
    year: '2005',
    posterUrl: null,
    watchedAt: '2026-09-13T12:00:00.000Z',
  }] };
  const tvProgress = { status: 'available', records: [
    { tvId: 1, trackableSeasonNumbers: [1, 2], watchedSeasonNumbers: [1], episodeProgress: [] },
    { tvId: 2, trackableSeasonNumbers: [1, 2], watchedSeasonNumbers: [1, 2], episodeProgress: [] },
  ] };

  assert.equal(getWatchlistStatus(movieItems[0], tvProgress, movieProgress), 'watched');
  assert.equal(getWatchlistStatus(movieItems[1], tvProgress, movieProgress), 'to-watch');
  assert.equal(getWatchlistStatus(tvItems[0], tvProgress, movieProgress), 'to-watch');
  assert.equal(getWatchlistStatus(tvItems[1], tvProgress, movieProgress), 'watched');
  assert.equal(getWatchlistStatus(tvItems[2], tvProgress, movieProgress), 'to-watch');
});

test('filters known statuses and retains unknown items only in All', () => {
  const items = [movieItems[0], movieItems[1], tvItems[0]];
  const tvProgress = { status: 'available', records: [{
    tvId: 1, trackableSeasonNumbers: [1], watchedSeasonNumbers: [1], episodeProgress: [],
  }] };
  const movieProgress = { status: 'available', records: [{
    movieId: 272,
    title: 'Batman Begins',
    year: '2005',
    posterUrl: null,
    watchedAt: '2026-09-13T12:00:00.000Z',
  }] };

  assert.deepEqual(filterWatchlistItems(items, 'all', tvProgress, movieProgress), items);
  assert.deepEqual(filterWatchlistItems(items, 'to-watch', tvProgress, movieProgress), [movieItems[1]]);
  assert.deepEqual(filterWatchlistItems(items, 'watched', tvProgress, movieProgress), [movieItems[0], tvItems[0]]);

  const unavailableMovies = { status: 'unavailable', reason: 'read-error' };
  assert.equal(getWatchlistStatus(movieItems[0], tvProgress, unavailableMovies), 'unknown');
  assert.deepEqual(filterWatchlistItems(items, 'all', tvProgress, unavailableMovies), items);
  assert.deepEqual(filterWatchlistItems(items, 'watched', tvProgress, unavailableMovies), [tvItems[0]]);

  const unavailableTv = { status: 'unavailable', reason: 'malformed' };
  assert.equal(getWatchlistStatus(tvItems[0], unavailableTv, movieProgress), 'unknown');
  assert.deepEqual(filterWatchlistItems(items, 'to-watch', unavailableTv, movieProgress), [movieItems[1]]);
});
