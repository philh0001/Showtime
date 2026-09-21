import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeSyncData } from '../src/services/sync-merge.ts';

const film = (id) => ({ id, mediaType: 'Movie', title: `Film ${id}`, year: null, posterUrl: null });
const movie = (movieId, watchedAt = '2026-01-01T00:00:00.000Z') => ({
  movieId, title: `Film ${movieId}`, year: null, posterUrl: null, watchedAt,
});

test('first login keeps distinct guest and cloud watchlist titles', () => {
  assert.deepEqual(mergeSyncData('watchlist', undefined, [film(1)], [film(2)]), [film(1), film(2)]);
});

test('a removal on one device survives an unchanged copy on another', () => {
  assert.deepEqual(mergeSyncData('watchlist', [film(1)], [], [film(1)]), []);
  assert.deepEqual(mergeSyncData('movie-progress', [movie(1)], [], [movie(1)]), []);
});

test('different offline edits to the same collection both survive', () => {
  assert.deepEqual(mergeSyncData('watchlist', [film(1)], [film(1), film(2)], [film(1), film(3)]),
    [film(1), film(2), film(3)]);
});

test('different episode changes within the same TV title both survive', () => {
  const base = [{ tvId: 8, trackableSeasonNumbers: [1], watchedSeasonNumbers: [], episodeProgress: [{
    seasonNumber: 1, knownEpisodeNumbers: [1, 2], trackableEpisodeNumbers: [1, 2], watchedEpisodeNumbers: [],
  }] }];
  const local = structuredClone(base);
  const remote = structuredClone(base);
  local[0].episodeProgress[0].watchedEpisodeNumbers = [1];
  remote[0].episodeProgress[0].watchedEpisodeNumbers = [2];
  const merged = mergeSyncData('tv-progress', base, local, remote);
  assert.deepEqual(merged[0].episodeProgress[0].watchedEpisodeNumbers, [1, 2]);
});

test('first sync combines different watched episodes for the same show', () => {
  const show = (watched) => [{ tvId: 8, trackableSeasonNumbers: [1], watchedSeasonNumbers: [],
    episodeProgress: [{ seasonNumber: 1, knownEpisodeNumbers: [1, 2, 3, 4, 5],
      trackableEpisodeNumbers: [1, 2, 3, 4, 5], watchedEpisodeNumbers: watched }] }];
  const merged = mergeSyncData('tv-progress', undefined, show([5]), show([1, 2, 3, 4]));
  assert.deepEqual(merged[0].episodeProgress[0].watchedEpisodeNumbers, [1, 2, 3, 4, 5]);
});

test('an explicit unwatch remains removed when another device watches a different episode', () => {
  const show = (watched) => [{ tvId: 8, trackableSeasonNumbers: [1], watchedSeasonNumbers: [],
    episodeProgress: [{ seasonNumber: 1, knownEpisodeNumbers: [1, 2],
      trackableEpisodeNumbers: [1, 2], watchedEpisodeNumbers: watched }] }];
  const merged = mergeSyncData('tv-progress', show([1]), show([]), show([1, 2]));
  assert.deepEqual(merged[0].episodeProgress[0].watchedEpisodeNumbers, [2]);
});

test('movie and TV titles sharing a TMDB number remain separate', () => {
  const tv = { id: 1, mediaType: 'TV', title: 'Show', year: null, posterUrl: null };
  assert.deepEqual(mergeSyncData('watchlist', undefined, [film(1)], [tv]), [film(1), tv]);
});

test('viewing history preserves events from devices with colliding local sequence numbers', () => {
  const event = (id, titleId) => ({ id, sequence: 1, happenedAt: '2026-01-01T00:00:00.000Z',
    title: film(titleId), action: { kind: 'movie', watched: true } });
  const merged = mergeSyncData('viewing-activity', undefined, [event('a', 1)], [event('b', 2)]);
  assert.equal(merged.length, 2);
  assert.deepEqual(new Set(merged.map((item) => item.id)), new Set(['a', 'b']));
  assert.deepEqual(new Set(merged.map((item) => item.sequence)), new Set([1, 2]));
});
