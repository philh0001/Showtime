import assert from 'node:assert/strict';
import test from 'node:test';

import { handleSchedule } from './schedule.mjs';

const route = { kind: 'tv-schedule', id: 123, cacheKey: '/schedule/tv/123', cost: 13 };
const summary = {
  id: 123, name: 'Example', poster_path: '/poster.jpg',
  seasons: [
    { id: 1, season_number: 0, episode_count: 2 },
    { id: 2, season_number: 1, episode_count: 3 },
    { id: 3, season_number: 2, episode_count: 2 },
  ],
};
const episode = (id, season, number, airDate) => ({
  id, season_number: season, episode_number: number, name: `Episode ${number}`, air_date: airDate,
});
function fixture(updates = {}) {
  const calls = [];
  const payloads = {
    '/3/tv/123': summary,
    '/3/tv/123/season/1': { id: 2, season_number: 1, episodes: [
      episode(10, 1, 1, '2026-09-20'), episode(11, 1, 2, '2026-09-24'),
      episode(12, 1, 3, null),
    ] },
    '/3/tv/123/season/2': { id: 3, season_number: 2, episodes: [
      episode(20, 2, 1, '2026-09-22'), episode(21, 2, 2, '2026-02-30'),
    ] },
    ...updates,
  };
  const fetchTmdbJson = async ({ endpoint }) => {
    calls.push(endpoint);
    const value = payloads[endpoint];
    if (value instanceof Error) throw value;
    return value;
  };
  return { calls, fetchTmdbJson };
}
const load = (f, now = new Date('2026-09-21T12:00:00Z')) => handleSchedule(route, {
  token: 'test-token', fetchTmdbJson: f.fetchTmdbJson, now,
});

test('returns dated regular episodes in calendar order without inventing a season premiere', async () => {
  const f = fixture();
  const result = await load(f);
  assert.equal(result.status, 200);
  assert.equal(result.body.schedule.coverage, 'complete');
  assert.deepEqual(result.body.schedule.episodes.map(({ id }) => id), [10, 20, 11]);
  assert.deepEqual(result.body.schedule.seasonCoverage, [
    { seasonNumber: 1, status: 'checked' }, { seasonNumber: 2, status: 'checked' },
  ]);
  assert.equal(result.body.schedule.title, 'Example');
  assert.equal(result.body.schedule.posterUrl, 'https://image.tmdb.org/t/p/w500/poster.jpg');
  assert.equal(f.calls.includes('/3/tv/123/season/0'), false);
});

test('marks failed seasons unavailable and keeps a separate next episode candidate', async () => {
  const f = fixture({
    '/3/tv/123': { ...summary, next_episode_to_air: episode(30, 2, 3, '2026-09-26') },
    '/3/tv/123/season/2': new Error('temporary'),
  });
  const result = await load(f);
  assert.equal(result.status, 200);
  assert.equal(result.body.schedule.coverage, 'partial');
  assert.deepEqual(result.body.schedule.seasonCoverage, [
    { seasonNumber: 1, status: 'checked' }, { seasonNumber: 2, status: 'unavailable' },
  ]);
  assert.equal(result.body.schedule.nextEpisode.id, 30);
});

test('missing or malformed primary show is an error, not a confident empty schedule', async () => {
  for (const value of [undefined, { id: 123, seasons: [] },
    { ...summary, seasons: [{ id: 2, season_number: 1, episode_count: null }] },
    new Error('upstream')]) {
    const result = await load(fixture({ '/3/tv/123': value }));
    assert.equal(result.status, 502);
    assert.equal(result.body.schedule, undefined);
  }
});

test('caps season requests and marks omitted seasons limited', async () => {
  const seasons = Array.from({ length: 15 }, (_, index) => ({
    id: index + 101, season_number: index + 1, episode_count: 1,
  }));
  const updates = { '/3/tv/123': { ...summary, seasons } };
  for (const season of seasons) updates[`/3/tv/123/season/${season.season_number}`] = {
    id: season.id, season_number: season.season_number,
    episodes: [episode(season.id + 1000, season.season_number, 1, '2026-10-01')],
  };
  const f = fixture(updates);
  const result = await load(f);
  assert.equal(f.calls.length, 13);
  assert.equal(result.body.schedule.seasonCoverage.filter(({ status }) => status === 'limited').length, 3);
  assert.equal(result.body.schedule.coverage, 'partial');
});

test('bounds dated results to 200 and identifies affected seasons', async () => {
  const f = fixture({
    '/3/tv/123/season/1': { id: 2, season_number: 1, episodes: Array.from({ length: 220 }, (_, i) =>
      episode(i + 100, 1, i + 1, '2026-10-01')) },
  });
  const result = await load(f);
  assert.equal(result.body.schedule.episodes.length, 200);
  assert.deepEqual(result.body.schedule.seasonCoverage[0], { seasonNumber: 1, status: 'limited' });
  assert.equal(result.body.schedule.coverage, 'partial');
});

test('rejects an implausibly large season summary rather than returning an unbounded body', async () => {
  const seasons = Array.from({ length: 101 }, (_, index) => ({
    id: index + 100, season_number: index + 1, episode_count: 1,
  }));
  const result = await load(fixture({ '/3/tv/123': { ...summary, seasons } }));
  assert.equal(result.status, 502);
  assert.equal(result.body.schedule, undefined);
});
