import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getWatchlistProgressLabel,
  loadWatchlistProgressData,
} from '../src/services/watchlist-progress.ts';

const tvItems = [1, 2, 3].map((id) => ({
  id, mediaType: 'TV', title: `Show ${id}`, year: '2026', posterUrl: null,
}));

test('loads Watchlist and progress collections once regardless of TV item count', async () => {
  let watchlistReads = 0;
  let progressReads = 0;
  let networkCalls = 0;
  const data = await loadWatchlistProgressData({
    loadWatchlist: async () => {
      watchlistReads += 1;
      return tvItems;
    },
    loadProgress: async () => {
      progressReads += 1;
      return { status: 'available', records: [
        { tvId: 1, trackableSeasonNumbers: [1, 2], watchedSeasonNumbers: [1], episodeProgress: [] },
      ] };
    },
  });

  assert.equal(data.items.length, 3);
  assert.equal(watchlistReads, 1);
  assert.equal(progressReads, 1);
  assert.equal(networkCalls, 0);
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
