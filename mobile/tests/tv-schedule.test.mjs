import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTvSchedules, getUpcomingEpisodes } from '../src/services/tv-schedule-rules.ts';
import { createTvScheduleStorage } from '../src/services/tv-schedule-storage.ts';

const episode = (id, airDate, episodeNumber = id) => ({ id, airDate, episodeNumber, seasonNumber: 1, name: null });
const schedule = (id, overrides = {}) => ({ id, title: `Show ${id}`, mediaType: 'TV', year: '2026', posterUrl: null,
  checkedAt: '2026-09-13T12:00:00.000Z', nextEpisode: episode(1, '2026-09-14'), episodes: [], ...overrides });

test('schedule parsing distinguishes unreadable from empty and salvages newest valid records', () => {
  assert.deepEqual(parseTvSchedules(null), { status: 'available', records: [] });
  assert.equal(parseTvSchedules('{bad').status, 'unavailable');
  assert.equal(parseTvSchedules('{}').status, 'unavailable');
  const result = parseTvSchedules(JSON.stringify([
    schedule(1), schedule(1, { checkedAt: '2026-09-12T12:00:00.000Z', title: 'Old' }),
    schedule(-1), schedule(2, { checkedAt: 'invalid' }), schedule(3, { mediaType: 'Movie' }),
    schedule(4, { episodes: [episode(2, 'invalid'), episode(3, '2026-09-15')] }),
  ]));
  assert.deepEqual(result.records.map((item) => item.id), [1, 4]);
  assert.equal(result.records[0].title, 'Show 1');
  assert.equal(result.records[1].episodes.length, 1);
});

test('upcoming joins saved and actively tracked shows and skips past, watched and special episodes', () => {
  const records = [schedule(1, { nextEpisode: episode(1, '2026-09-12'), episodes: [episode(2, '2026-09-13'), episode(3, '2026-09-15')] }),
    schedule(2), schedule(3), schedule(4, { nextEpisode: { ...episode(1, '2026-09-13'), seasonNumber: 0 } })];
  const progress = { status: 'available', records: [{ tvId: 1, trackableSeasonNumbers: [1], watchedSeasonNumbers: [],
    episodeProgress: [{ seasonNumber: 1, knownEpisodeNumbers: [1, 2, 3], trackableEpisodeNumbers: [1, 2], watchedEpisodeNumbers: [2] }] }] };
  const result = getUpcomingEpisodes(records, [schedule(2), schedule(4)], progress, '2026-09-13');
  assert.deepEqual(result.map((item) => [item.id, item.episode.airDate]), [[2, '2026-09-14'], [1, '2026-09-15']]);
  assert.deepEqual(getUpcomingEpisodes(records, [], { status: 'available', records: [] }, '2026-09-13'), []);
});

test('schedule cache serializes concurrent writes and refuses to overwrite unreadable storage', async () => {
  let stored = null;
  const cache = createTvScheduleStorage({ getItem: async () => stored, setItem: async (_key, value) => { stored = value; } });
  await Promise.all([cache.record(schedule(1)), cache.record(schedule(2))]);
  assert.deepEqual((await cache.load()).records.map((item) => item.id), [1, 2]);
  stored = '{bad';
  await assert.rejects(cache.record(schedule(3)));
  assert.equal(stored, '{bad');
  stored = null;
  await cache.record(schedule(3));
  assert.equal((await cache.load()).records[0].id, 3);
});

test('schedule read and write failures remain observable without destroying prior data', async () => {
  const cache = createTvScheduleStorage({ getItem: async () => { throw new Error('read'); }, setItem: async () => assert.fail('must not write') });
  assert.equal((await cache.load()).status, 'unavailable');
  await assert.rejects(cache.record(schedule(1)));
  const writeFailure = createTvScheduleStorage({ getItem: async () => null, setItem: async () => { throw new Error('write'); } });
  await assert.rejects(writeFailure.record(schedule(1)));
});
