import assert from 'node:assert/strict';
import test from 'node:test';

import { createHomeScheduleRefresh, selectScheduleIdsToRefresh } from '../src/services/home-schedule-refresh.ts';

const nowMs = Date.parse('2026-09-21T12:00:00.000Z');
const saved = (id, mediaType = 'TV') => ({ id, mediaType, title: `Show ${id}`, year: '2026', posterUrl: null });
const schedule = (id, checkedAt = '2026-09-21T11:00:00.000Z') => ({
  ...saved(id), checkedAt, nextEpisode: null, episodes: [],
});
const noProgress = { status: 'available', records: [] };

test('selects missing and stale saved shows, including tracked shows, without movies or fresh schedules', () => {
  const progress = { status: 'available', records: [{
    tvId: 4, trackableSeasonNumbers: [1], watchedSeasonNumbers: [1], episodeProgress: [],
  }] };
  assert.deepEqual(selectScheduleIdsToRefresh({
    watchlist: [saved(1), saved(2), saved(3, 'Movie')],
    progress,
    cache: { status: 'available', records: [schedule(1)] },
    nowMs,
  }), [2, 4]);
  assert.deepEqual(selectScheduleIdsToRefresh({
    watchlist: [saved(1)], progress: noProgress,
    cache: { status: 'available', records: [schedule(1, '2026-09-19T11:00:00.000Z')] },
    nowMs,
  }), [1]);
  assert.deepEqual(selectScheduleIdsToRefresh({
    watchlist: [saved(1)], progress: noProgress, cache: { status: 'unavailable' }, nowMs,
  }), []);
});

test('fills missing schedules without opening details and bounds concurrent requests', async () => {
  let records = [schedule(1)];
  const fetched = [];
  let active = 0;
  let maxActive = 0;
  const refresh = createHomeScheduleRefresh({
    async fetchTvDetails(id) {
      fetched.push(id);
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return { id, mediaType: 'TV' };
    },
    async recordTvSchedule(details) { records = [...records, schedule(details.id)]; },
    async loadTvSchedules() { return { status: 'available', records }; },
  });
  const result = await refresh({
    watchlist: [saved(1), saved(2), saved(3), saved(4, 'Movie')],
    progress: noProgress,
    cache: { status: 'available', records },
    signal: new AbortController().signal,
    nowMs,
  });
  assert.deepEqual(fetched.sort(), [2, 3]);
  assert.ok(maxActive <= 2);
  assert.equal(result.failed, 0);
  assert.deepEqual(result.cache.records.map(({ id }) => id), [1, 2, 3]);
});

test('a failed schedule request preserves other results and backs off until manual retry', async () => {
  let records = [];
  let fail = true;
  const fetched = [];
  const refresh = createHomeScheduleRefresh({
    async fetchTvDetails(id) {
      fetched.push(id);
      if (id === 2 && fail) throw new Error('network');
      return { id, mediaType: 'TV' };
    },
    async recordTvSchedule(details) { records = [...records, schedule(details.id)]; },
    async loadTvSchedules() { return { status: 'available', records }; },
  });
  const args = () => ({ watchlist: [saved(1), saved(2)], progress: noProgress,
    cache: { status: 'available', records }, signal: new AbortController().signal, nowMs });
  const first = await refresh(args());
  assert.equal(first.failed, 1);
  assert.deepEqual(first.cache.records.map(({ id }) => id), [1]);
  await refresh(args());
  assert.deepEqual(fetched, [1, 2]);
  fail = false;
  const retried = await refresh({ ...args(), force: true });
  assert.deepEqual(fetched, [1, 2, 2]);
  assert.equal(retried.failed, 0);
  assert.deepEqual(retried.cache.records.map(({ id }) => id), [1, 2]);
});

test('does not start requests after navigation aborts the refresh', async () => {
  let fetched = 0;
  const refresh = createHomeScheduleRefresh({
    async fetchTvDetails() { fetched += 1; throw new Error('must not run'); },
    async recordTvSchedule() { throw new Error('must not run'); },
    async loadTvSchedules() { return { status: 'available', records: [] }; },
  });
  const controller = new AbortController();
  controller.abort();
  await refresh({ watchlist: [saved(1)], progress: noProgress,
    cache: { status: 'available', records: [] }, signal: controller.signal, nowMs });
  assert.equal(fetched, 0);
});

test('moves through a large Watchlist when an earlier batch is waiting to retry', async () => {
  const fetched = [];
  const refresh = createHomeScheduleRefresh({
    async fetchTvDetails(id) { fetched.push(id); throw new Error('offline'); },
    async recordTvSchedule() { throw new Error('must not run'); },
    async loadTvSchedules() { return { status: 'available', records: [] }; },
  });
  const input = { watchlist: Array.from({ length: 10 }, (_, index) => saved(index + 1)),
    progress: noProgress, cache: { status: 'available', records: [] },
    signal: new AbortController().signal, nowMs };
  await refresh(input);
  await refresh(input);
  assert.deepEqual(fetched, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});
