import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTvSchedules, getUpcomingEpisodes, mergeScheduleResponse, getHomeSchedule, isFreshCompleteHomeSchedule } from '../src/services/tv-schedule-rules.ts';
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

test('a checked season replaces rescheduled episodes while an unavailable season retains stale dates', () => {
  const old = schedule(1, { coverage: 'complete', apiCheckedAt: '2026-09-20T12:00:00.000Z',
    seasonCoverage: [{ seasonNumber: 1, status: 'checked' }, { seasonNumber: 2, status: 'checked' }],
    nextEpisode: { ...episode(21, '2026-09-26'), seasonNumber: 2 },
    episodes: [episode(10, '2026-09-22'), { ...episode(20, '2026-09-25'), seasonNumber: 2 }] });
  const incoming = { id: 1, title: 'Show 1', posterUrl: null, coverage: 'partial',
    seasonCoverage: [{ seasonNumber: 1, status: 'checked' }, { seasonNumber: 2, status: 'unavailable' }],
    nextEpisode: null, episodes: [episode(10, '2026-09-23')] };
  const merged = mergeScheduleResponse(old, incoming, '2026-09-21T12:00:00.000Z');
  assert.deepEqual(merged.episodes.map((item) => [item.id, item.airDate]),
    [[10, '2026-09-23'], [20, '2026-09-25']]);
  assert.deepEqual(merged.staleSeasonNumbers, [2]);
  assert.equal(merged.nextEpisode.id, 21);
  const complete = mergeScheduleResponse(merged, { ...incoming, coverage: 'complete',
    seasonCoverage: incoming.seasonCoverage.map((item) => ({ ...item, status: 'checked' })),
    episodes: [episode(10, '2026-09-23')] }, '2026-09-22T12:00:00.000Z');
  assert.deepEqual(complete.episodes.map((item) => item.id), [10]);
  assert.deepEqual(complete.staleSeasonNumbers, []);
});

test('Home groups saved-show dated releases independent of watched progress and across Sunday', () => {
  const records = [schedule(1, { episodes: [episode(1, '2026-09-21'), episode(2, '2026-09-21'),
    { ...episode(1, '2026-09-22'), episodeNumber: 9 },
    episode(3, '2026-09-22'), episode(4, '2026-09-27'), episode(5, '2026-09-28')] })];
  const view = getHomeSchedule(records, new Set([1]), '2026-09-21');
  assert.deepEqual(view.today.map((row) => row.episodes.length), [2]);
  assert.deepEqual(view.weekDays.map((day) => day.date), ['2026-09-22', '2026-09-27']);
  assert.deepEqual(view.weekDays[0].rows[0].episodes.map((item) => item.id), [3]);
  assert.deepEqual(view.comingSoon.map((row) => row.date), ['2026-09-28']);
  assert.deepEqual(getHomeSchedule(records, new Set(), '2026-09-21').today, []);
  assert.deepEqual(getHomeSchedule(records, new Set([1]), '2026-09-27').weekDays, []);
});

test('detail visits seed only missing schedule records after API checks', async () => {
  let stored = null;
  const cache = createTvScheduleStorage({ getItem: async () => stored,
    setItem: async (_key, value) => { stored = value; } });
  const api = mergeScheduleResponse(undefined, { id: 1, title: 'Show 1', posterUrl: null,
    coverage: 'complete', seasonCoverage: [{ seasonNumber: 1, status: 'checked' }],
    nextEpisode: null, episodes: [episode(10, '2026-09-22')] }, '2026-09-21T12:00:00.000Z');
  await cache.mergeApi(api);
  await cache.seedIfMissing(schedule(1, { episodes: [episode(99, '2026-09-23')] }));
  assert.deepEqual((await cache.load()).records[0].episodes.map((item) => item.id), [10]);
  await cache.seedIfMissing(schedule(2));
  assert.deepEqual((await cache.load()).records.map((item) => item.id), [1, 2]);
});

test('confirmed empty copy requires every saved show to have a fresh complete API check', () => {
  const checked = schedule(1, { coverage: 'complete', apiCheckedAt: '2026-09-21T10:00:00.000Z',
    seasonCoverage: [{ seasonNumber: 1, status: 'checked' }] });
  const now = Date.parse('2026-09-21T12:00:00Z');
  assert.equal(isFreshCompleteHomeSchedule([checked], new Set([1]), now), true);
  assert.equal(isFreshCompleteHomeSchedule([checked], new Set([1, 2]), now), false);
  assert.equal(isFreshCompleteHomeSchedule([checked], new Set([1]), now + 13 * 60 * 60 * 1000), false);
  assert.equal(isFreshCompleteHomeSchedule([schedule(1)], new Set([1]), now), false);
});

test('a successful API result replaces the same show even if an old device clock was ahead', async () => {
  let stored = JSON.stringify([schedule(1, { checkedAt: '2030-01-01T00:00:00.000Z',
    episodes: [episode(99, '2030-01-02')] })]);
  const cache = createTvScheduleStorage({ getItem: async () => stored,
    setItem: async (_key, value) => { stored = value; } });
  const updated = mergeScheduleResponse(undefined, { id: 1, title: 'Show 1', posterUrl: null,
    coverage: 'complete', seasonCoverage: [{ seasonNumber: 1, status: 'checked' }],
    nextEpisode: null, episodes: [episode(10, '2026-09-23')] }, '2026-09-21T12:00:00.000Z');
  await cache.mergeApi(updated);
  assert.deepEqual((await cache.load()).records[0].episodes.map((item) => item.id), [10]);
});
