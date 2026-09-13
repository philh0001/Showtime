import assert from 'node:assert/strict';
import test from 'node:test';

import { loadHomeData } from '../src/services/home-data.ts';

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

test('loads both local Home collections exactly once', async () => {
  let recentReads = 0;
  let watchlistReads = 0;
  const data = await loadHomeData({
    loadRecentlyViewed: async () => {
      recentReads += 1;
      return { status: 'available', items: recentItems };
    },
    loadWatchlist: async () => {
      watchlistReads += 1;
      return watchlistItems;
    },
  });

  assert.deepEqual(data, {
    recentlyViewed: { status: 'available', items: recentItems },
    watchlist: { status: 'available', items: watchlistItems },
  });
  assert.equal(recentReads, 1);
  assert.equal(watchlistReads, 1);
});

test('keeps Recently Viewed available when Watchlist loading fails', async () => {
  const data = await loadHomeData({
    loadRecentlyViewed: async () => ({ status: 'available', items: recentItems }),
    loadWatchlist: async () => { throw new Error('watchlist read failed'); },
  });

  assert.deepEqual(data, {
    recentlyViewed: { status: 'available', items: recentItems },
    watchlist: { status: 'unavailable' },
  });
});

test('keeps Watchlist available when Recently Viewed is unavailable', async () => {
  const data = await loadHomeData({
    loadRecentlyViewed: async () => ({ status: 'unavailable', reason: 'malformed' }),
    loadWatchlist: async () => watchlistItems,
  });

  assert.deepEqual(data, {
    recentlyViewed: { status: 'unavailable', reason: 'malformed' },
    watchlist: { status: 'available', items: watchlistItems },
  });
});

test('converts a rejected Recently Viewed read without affecting Watchlist', async () => {
  const data = await loadHomeData({
    loadRecentlyViewed: async () => { throw new Error('unexpected read failure'); },
    loadWatchlist: async () => watchlistItems,
  });

  assert.deepEqual(data, {
    recentlyViewed: { status: 'unavailable', reason: 'read-error' },
    watchlist: { status: 'available', items: watchlistItems },
  });
});
