import assert from 'node:assert/strict';
import test from 'node:test';
import { createSavedScheduleRefresh } from '../src/services/saved-schedule-refresh-rules.ts';

const show = (id, mediaType = 'TV') => ({ id, mediaType, title: `Show ${id}`, year: null, posterUrl: null });
const response = (id) => ({ id, title: `Show ${id}`, posterUrl: null, coverage: 'complete',
  seasonCoverage: [{ seasonNumber: 1, status: 'checked' }], nextEpisode: null,
  episodes: [{ id: id * 100, name: null, seasonNumber: 1, episodeNumber: 1, airDate: '2026-09-22' }] });

test('fetches only saved TV shows, emits each result, and shares in-flight work', async () => {
  let records = [];
  const calls = [];
  const updates = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const refresh = createSavedScheduleRefresh({
    fetchSchedule: async (id) => { calls.push(id); await gate; return response(id); },
    load: async () => ({ status: 'available', records }),
    save: async (record) => { records = [record, ...records.filter((item) => item.id !== record.id)]; },
    now: () => Date.parse('2026-09-21T12:00:00Z'),
    wait: async () => {},
  });
  const first = refresh([show(1), show(2, 'Movie')], { onUpdate: (next) => updates.push(next) });
  const second = refresh([show(1)], {});
  await Promise.resolve();
  release();
  const [one, two] = await Promise.all([first, second]);
  assert.deepEqual(calls, [1]);
  assert.equal(one.records.length, 1);
  assert.equal(two.records.length, 1);
  assert.equal(updates.length, 1);
});

test('legacy records refresh immediately and complete records respect twelve-hour freshness', async () => {
  let records = [{ id: 1, mediaType: 'TV', title: 'Show 1', year: null, posterUrl: null,
    checkedAt: '2026-09-21T11:00:00.000Z', coverage: 'legacy', nextEpisode: null, episodes: [] }];
  let calls = 0;
  const refresh = createSavedScheduleRefresh({
    fetchSchedule: async () => { calls++; return response(1); },
    load: async () => ({ status: 'available', records }),
    save: async (record) => { records = [record]; },
    now: () => Date.parse('2026-09-21T12:00:00Z'), wait: async () => {},
  });
  await refresh([show(1)], {});
  await refresh([show(1)], {});
  assert.equal(calls, 1);
});

test('429 pauses requests for a minute and retries once without discarding cached rows', async () => {
  let clock = Date.parse('2026-09-21T12:00:00Z');
  let records = [];
  let attempts = 0;
  const waits = [];
  const refresh = createSavedScheduleRefresh({
    fetchSchedule: async () => {
      attempts++;
      if (attempts === 1) throw { status: 429 };
      return response(1);
    },
    load: async () => ({ status: 'available', records }),
    save: async (record) => { records = [record]; },
    now: () => clock,
    wait: async (ms) => { waits.push(ms); clock += ms; },
  });
  const result = await refresh([show(1)], {});
  assert.equal(attempts, 2);
  assert.ok(waits.some((ms) => ms >= 60_000));
  assert.deepEqual(result.failedIds, []);
  assert.equal(result.records[0].episodes[0].id, 100);
});

test('a temporary failure leaves the prior API check intact and backs off', async () => {
  const cached = { id: 1, mediaType: 'TV', title: 'Show 1', year: null, posterUrl: null,
    checkedAt: '2026-09-20T10:00:00.000Z', apiCheckedAt: '2026-09-20T10:00:00.000Z',
    coverage: 'complete', seasonCoverage: [{ seasonNumber: 1, status: 'checked' }],
    nextEpisode: null, episodes: response(1).episodes };
  let calls = 0;
  const refresh = createSavedScheduleRefresh({
    fetchSchedule: async () => { calls++; throw new Error('offline'); },
    load: async () => ({ status: 'available', records: [cached] }),
    save: async () => assert.fail('failure must not overwrite cache'),
    now: () => Date.parse('2026-09-21T12:00:00Z'), wait: async () => {},
  });
  const first = await refresh([show(1)], {});
  await refresh([show(1)], {});
  assert.deepEqual(first.failedIds, [1]);
  assert.equal(first.records[0].apiCheckedAt, cached.apiCheckedAt);
  assert.equal(calls, 1);
});

test('thirty uncached saved shows fill incrementally within two concurrent and six-per-minute requests', async () => {
  let clock = Date.parse('2026-09-21T12:00:00Z');
  let records = [];
  let active = 0;
  let maxActive = 0;
  const starts = [];
  const updates = [];
  const refresh = createSavedScheduleRefresh({
    fetchSchedule: async (id) => {
      starts.push(clock);
      active++;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active--;
      return response(id);
    },
    load: async () => ({ status: 'available', records }),
    save: async (record) => { records = [record, ...records.filter((item) => item.id !== record.id)]; },
    now: () => clock,
    wait: async (ms) => { clock += ms; },
  });
  const result = await refresh(Array.from({ length: 30 }, (_, i) => show(i + 1)), {
    onUpdate: (next) => updates.push(next.length),
  });
  assert.equal(result.records.length, 30);
  assert.equal(starts.length, 30);
  assert.ok(maxActive <= 2);
  assert.equal(updates[0] > 0, true);
  assert.equal(updates.at(-1), 30);
  for (const start of starts) {
    assert.ok(starts.filter((other) => other >= start && other < start + 60_000).length <= 6);
  }
});

test('reports one failed show before a slower show settles and keeps it visible during backoff', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const failures = [];
  const refresh = createSavedScheduleRefresh({
    fetchSchedule: async (id) => { if (id === 1) throw new Error('offline'); await gate; return response(id); },
    load: async () => ({ status: 'available', records: [] }),
    save: async () => {},
    now: () => Date.parse('2026-09-21T12:00:00Z'), wait: async () => {},
  });
  const pending = refresh([show(1), show(2)], { onFailure: (id) => failures.push(id) });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(failures, [1]);
  release();
  await pending;
  const repeated = await refresh([show(1)], { onFailure: (id) => failures.push(id) });
  assert.deepEqual(repeated.failedIds, [1]);
  assert.deepEqual(failures, [1, 1]);
});
