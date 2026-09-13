import assert from 'node:assert/strict';
import test from 'node:test';
import { parseViewingActivity, describeViewingAction, filterViewingActivity } from '../src/services/viewing-activity-rules.ts';
import { createViewingActivityStorage } from '../src/services/viewing-activity-storage.ts';

const movie = { id: 1, mediaType: 'Movie', title: 'Movie', year: '2026', posterUrl: null };
const show = { ...movie, id: 2, mediaType: 'TV', title: 'Show' };
const event = (sequence, overrides = {}) => ({ sequence, title: movie,
  action: { kind: 'movie', watched: true }, happenedAt: '2026-09-13T12:00:00.000Z', ...overrides });

test('activity parsing preserves valid events, rejects malformed actions and orders newest first', () => {
  const parsed = parseViewingActivity(JSON.stringify([
    event(1), event(2, { action: { kind: 'movie', watched: false } }), event(3, { happenedAt: 'invalid' }),
    event(4, { title: show }), event(5, { action: { kind: 'episode', seasonNumber: 0, episodeNumber: 1, watched: true } }),
    event(6, { title: show, action: { kind: 'aired', seasonNumber: 1, episodeNumbers: [2, 1, 2], watched: true } }),
  ]));
  assert.deepEqual(parsed.records.map((item) => item.sequence), [6, 2, 1]);
  assert.deepEqual(parsed.records[0].action.episodeNumbers, [1, 2]);
  assert.deepEqual(parseViewingActivity(null), { status: 'available', records: [] });
  for (const value of ['{bad', '{}', 'null']) assert.equal(parseViewingActivity(value).status, 'unavailable');
});

test('activity keeps current-status reversals and filters movie/TV IDs independently', () => {
  const records = [event(1), event(2, { title: { ...show, id: 1 }, action: { kind: 'season', seasonNumber: 2, watched: false } })];
  assert.equal(filterViewingActivity(records, 'all').length, 2);
  assert.deepEqual(filterViewingActivity(records, 'Movie').map((item) => item.sequence), [1]);
  assert.deepEqual(filterViewingActivity(records, 'TV').map((item) => item.sequence), [2]);
  assert.equal(describeViewingAction(records[1].action), 'Marked season 2 unwatched');
  assert.equal(describeViewingAction({ kind: 'episode', seasonNumber: 3, episodeNumber: 4, watched: true }), 'Watched S3 E4');
  assert.equal(describeViewingAction({ kind: 'aired', seasonNumber: 1, episodeNumbers: [2, 3], watched: true }), 'Watched 2 episodes in season 1');
});

test('concurrent history writes preserve all actions, including repeat viewings', async () => {
  let stored = null;
  const storage = createViewingActivityStorage({ getItem: async () => stored, setItem: async (_key, value) => { stored = value; } }, () => '2026-09-13T12:00:00.000Z');
  await Promise.all([
    storage.record(movie, { kind: 'movie', watched: true }),
    storage.record(movie, { kind: 'movie', watched: false }),
    storage.record(movie, { kind: 'movie', watched: true }),
  ]);
  const loaded = await storage.load();
  assert.deepEqual(loaded.records.map((item) => item.sequence), [3, 2, 1]);
  assert.deepEqual(loaded.records.map((item) => item.action.watched), [true, false, true]);
});

test('history preserves unreadable storage and recovers after a failed write', async () => {
  let stored = '{bad';
  let failWrite = false;
  const storage = createViewingActivityStorage({ getItem: async () => stored, setItem: async (_key, value) => {
    if (failWrite) throw new Error('write');
    stored = value;
  } });
  await assert.rejects(storage.record(movie, { kind: 'movie', watched: true }));
  assert.equal(stored, '{bad');
  stored = null;
  failWrite = true;
  await assert.rejects(storage.record(movie, { kind: 'movie', watched: true }));
  assert.equal(stored, null);
  failWrite = false;
  await storage.record(movie, { kind: 'movie', watched: true });
  assert.equal((await storage.load()).records.length, 1);
});
