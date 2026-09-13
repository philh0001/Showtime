import assert from 'node:assert/strict';
import test from 'node:test';
import { getContinueWatching, getViewingStats } from '../src/services/viewing-summary.ts';

const tv = (id) => ({ id, mediaType: 'TV', title: `Show ${id}`, year: null, posterUrl: null });
const progress = (tvId, watchedSeasonNumbers = [], episodeProgress = []) => ({
  tvId, trackableSeasonNumbers: [1, 2], watchedSeasonNumbers, episodeProgress,
});
const available = (records) => ({ status: 'available', records });
const episode = { seasonNumber: 2, knownEpisodeNumbers: [1, 2, 3, 4],
  trackableEpisodeNumbers: [1, 2, 3], watchedEpisodeNumbers: [1] };

test('Continue Watching joins TV metadata, deduplicates, and excludes completed and untouched titles', () => {
  const items = getContinueWatching([tv(1), tv(2), tv(3), tv(4)], [
    { ...tv(1), title: 'Updated title', viewedAt: '2026-09-13T12:00:00.000Z' },
    { ...tv(5), viewedAt: '2026-09-12T12:00:00.000Z' },
    { ...tv(6), mediaType: 'Movie', viewedAt: '2026-09-12T12:00:00.000Z' },
  ], available([progress(1, [1], [episode]), progress(2), progress(3, [1, 2]),
    progress(4, [], [episode]), progress(5, [1]), progress(6, [1]), progress(7, [1])]));
  assert.deepEqual(items.map((item) => item.id), [1, 5, 4]);
  assert.equal(items[0].title, 'Updated title');
  assert.equal(items[0].progress.watched, 1);
  assert.equal(items[0].progress.total, 2);
  assert.equal(items[0].progress.fraction, 0.625);
  assert.equal(items[2].progress.fraction, 0.125);
});

test('stale watched values and episode-authoritative seasons do not invent progress', () => {
  const items = getContinueWatching([tv(1), tv(2)], [], available([
    progress(1, [9], [{ ...episode, watchedEpisodeNumbers: [99] }]),
    progress(2, [2], [{ ...episode, watchedEpisodeNumbers: [] }]),
  ]));
  assert.deepEqual(items, []);
  assert.deepEqual(getContinueWatching([tv(1)], [], { status: 'unavailable', reason: 'read-error' }), []);
});

test('persistent TV snapshots keep unsaved active shows after Recently Viewed eviction', () => {
  const items = getContinueWatching([], [], available([progress(7, [1])]), [tv(7)]);
  assert.deepEqual(items.map((item) => item.id), [7]);
  assert.equal(items[0].progress.fraction, 0.5);
});

test('statistics count actual progress independently of Watchlist membership', () => {
  assert.deepEqual(getViewingStats({ status: 'available', items: [tv(1)] }, available([
    { movieId: 8 }, { movieId: 9 },
  ]), available([progress(1, [1], [episode]), progress(2), progress(3, [1, 2])])), {
    watchlist: 1, moviesWatched: 2, seasonsWatched: 3, showsTracked: 2, episodesWatched: 1,
  });
});

test('unavailable statistics stay unknown while independent totals remain visible', () => {
  assert.deepEqual(getViewingStats({ status: 'unavailable' }, available([]),
    { status: 'unavailable', reason: 'malformed' }), {
    watchlist: null, moviesWatched: 0, seasonsWatched: null, showsTracked: null, episodesWatched: null,
  });
});
