import assert from 'node:assert/strict';
import test from 'node:test';

import { loadHomeData } from '../src/services/home-data.ts';

test('loads TV progress once and isolates a failed TV read', async () => {
  let reads = 0;
  const data = await loadHomeData({
    loadTvSchedules: async () => ({ status: 'available', records: [] }),
    loadRecentlyViewed: async () => ({ status: 'available', items: [] }),
    loadWatchlist: async () => [],
    loadMovieProgress: async () => ({ status: 'available', records: [] }),
    loadTvProgress: async () => { reads += 1; throw new Error('read failed'); },
  });
  assert.equal(reads, 1);
  assert.deepEqual(data.tvProgress, { status: 'unavailable', reason: 'read-error' });
  assert.deepEqual(data.watchlist, { status: 'available', items: [] });
});

const recentItems = [{
  id: 44006,
  mediaType: 'TV',
  title: 'Chicago Fire',
  year: '2012',
  posterUrl: null,
  viewedAt: '2026-09-13T12:00:00.000Z',
}];

const watchlistItems = [{
  id: 272,
  mediaType: 'Movie',
  title: 'Batman Begins',
  year: '2005',
  posterUrl: null,
}];

const watchedMovies = [{
  movieId: 272,
  title: 'Batman Begins',
  year: '2005',
  posterUrl: null,
  watchedAt: '2026-09-13T12:00:00.000Z',
}];

test('loads local Home collections exactly once', async () => {
  let recentReads = 0;
  let watchlistReads = 0;
  let movieProgressReads = 0;
  const data = await loadHomeData({
    loadTvProgress: async () => ({ status: 'available', records: [] }),
    loadTvSchedules: async () => ({ status: 'available', records: [] }),
    loadRecentlyViewed: async () => {
      recentReads += 1;
      return { status: 'available', items: recentItems };
    },
    loadWatchlist: async () => {
      watchlistReads += 1;
      return watchlistItems;
    },
    loadMovieProgress: async () => {
      movieProgressReads += 1;
      return { status: 'available', records: watchedMovies };
    },
  });

  assert.deepEqual(data, {
    tvProgress: { status: 'available', records: [] },
    tvSchedules: { status: 'available', records: [] },
    recentlyViewed: { status: 'available', items: recentItems },
    watchlist: { status: 'available', items: watchlistItems },
    movieProgress: { status: 'available', records: watchedMovies },
  });
  assert.equal(recentReads, 1);
  assert.equal(watchlistReads, 1);
  assert.equal(movieProgressReads, 1);
});

test('keeps Recently Viewed available when Watchlist loading fails', async () => {
  const data = await loadHomeData({
    loadTvProgress: async () => ({ status: 'available', records: [] }),
    loadTvSchedules: async () => ({ status: 'available', records: [] }),
    loadRecentlyViewed: async () => ({ status: 'available', items: recentItems }),
    loadWatchlist: async () => { throw new Error('watchlist read failed'); },
    loadMovieProgress: async () => ({ status: 'available', records: watchedMovies }),
  });

  assert.deepEqual(data, {
    tvProgress: { status: 'available', records: [] },
    tvSchedules: { status: 'available', records: [] },
    recentlyViewed: { status: 'available', items: recentItems },
    watchlist: { status: 'unavailable' },
    movieProgress: { status: 'available', records: watchedMovies },
  });
});

test('keeps Watchlist available when Recently Viewed is unavailable', async () => {
  const data = await loadHomeData({
    loadTvProgress: async () => ({ status: 'available', records: [] }),
    loadTvSchedules: async () => ({ status: 'available', records: [] }),
    loadRecentlyViewed: async () => ({ status: 'unavailable', reason: 'malformed' }),
    loadWatchlist: async () => watchlistItems,
    loadMovieProgress: async () => ({ status: 'available', records: watchedMovies }),
  });

  assert.deepEqual(data, {
    tvProgress: { status: 'available', records: [] },
    tvSchedules: { status: 'available', records: [] },
    recentlyViewed: { status: 'unavailable', reason: 'malformed' },
    watchlist: { status: 'available', items: watchlistItems },
    movieProgress: { status: 'available', records: watchedMovies },
  });
});

test('converts a rejected Recently Viewed read without affecting Watchlist', async () => {
  const data = await loadHomeData({
    loadTvProgress: async () => ({ status: 'available', records: [] }),
    loadTvSchedules: async () => ({ status: 'available', records: [] }),
    loadRecentlyViewed: async () => { throw new Error('unexpected read failure'); },
    loadWatchlist: async () => watchlistItems,
    loadMovieProgress: async () => ({ status: 'available', records: watchedMovies }),
  });

  assert.deepEqual(data, {
    tvProgress: { status: 'available', records: [] },
    tvSchedules: { status: 'available', records: [] },
    recentlyViewed: { status: 'unavailable', reason: 'read-error' },
    watchlist: { status: 'available', items: watchlistItems },
    movieProgress: { status: 'available', records: watchedMovies },
  });
});

test('keeps other Home collections available when movie progress fails', async () => {
  const malformed = await loadHomeData({
    loadTvProgress: async () => ({ status: 'available', records: [] }),
    loadTvSchedules: async () => ({ status: 'available', records: [] }),
    loadRecentlyViewed: async () => ({ status: 'available', items: recentItems }),
    loadWatchlist: async () => watchlistItems,
    loadMovieProgress: async () => ({ status: 'unavailable', reason: 'malformed' }),
  });
  assert.deepEqual(malformed, {
    tvProgress: { status: 'available', records: [] },
    tvSchedules: { status: 'available', records: [] },
    recentlyViewed: { status: 'available', items: recentItems },
    watchlist: { status: 'available', items: watchlistItems },
    movieProgress: { status: 'unavailable', reason: 'malformed' },
  });

  const rejected = await loadHomeData({
    loadTvProgress: async () => ({ status: 'available', records: [] }),
    loadTvSchedules: async () => ({ status: 'available', records: [] }),
    loadRecentlyViewed: async () => ({ status: 'available', items: recentItems }),
    loadWatchlist: async () => watchlistItems,
    loadMovieProgress: async () => { throw new Error('movie progress failed'); },
  });
  assert.deepEqual(rejected, {
    tvProgress: { status: 'available', records: [] },
    tvSchedules: { status: 'available', records: [] },
    recentlyViewed: { status: 'available', items: recentItems },
    watchlist: { status: 'available', items: watchlistItems },
    movieProgress: { status: 'unavailable', reason: 'read-error' },
  });
});
