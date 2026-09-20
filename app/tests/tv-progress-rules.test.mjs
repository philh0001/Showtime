import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateTvProgress,
  commitTvProgressChange,
  deriveEpisodeMetadata,
  deriveTrackableSeasonNumbers,
  findEpisodeProgress,
  parseLegacyTvProgress,
  parseTvProgress,
  setAiredEpisodesWatched,
  setEpisodeWatched,
  setSeasonWatched,
  synchronizeTrackingMetadata,
  synchronizeTrackableSeasons,
} from '../src/services/tv-progress-rules.ts';
import {
  createTvProgressStorage,
  LEGACY_TV_PROGRESS_KEY,
  TV_PROGRESS_KEY,
} from '../src/services/tv-progress-storage.ts';

test('missing storage and a valid empty array mean available with no progress', () => {
  assert.deepEqual(parseTvProgress(null), { status: 'available', records: [] });
  assert.deepEqual(parseTvProgress('[]'), { status: 'available', records: [] });
});

test('migrates valid v1 records in memory without losing season progress', () => {
  assert.deepEqual(parseLegacyTvProgress(JSON.stringify([
    { tvId: 20, trackableSeasonNumbers: [2, 1], watchedSeasonNumbers: [2] },
  ])), { status: 'available', records: [
    { tvId: 20, trackableSeasonNumbers: [1, 2], watchedSeasonNumbers: [2], episodeProgress: [] },
  ] });
  assert.deepEqual(parseLegacyTvProgress('{broken'), { status: 'unavailable', reason: 'malformed' });
});

test('invalid top-level storage is unavailable rather than empty', () => {
  assert.deepEqual(parseTvProgress('{broken'), { status: 'unavailable', reason: 'malformed' });
  assert.deepEqual(parseTvProgress('{}'), { status: 'unavailable', reason: 'malformed' });
});

test('salvages valid records, merges duplicate TV IDs, and sorts unique season arrays', () => {
  const stored = JSON.stringify([
    { tvId: 20, trackableSeasonNumbers: [3, 1, 3, 0, -1, '2'], watchedSeasonNumbers: [3, 9, 3], episodeProgress: [
      { seasonNumber: 3, knownEpisodeNumbers: [2, 1, 2, 0], trackableEpisodeNumbers: [1], watchedEpisodeNumbers: [1, 9] },
    ] },
    { tvId: 20, trackableSeasonNumbers: [2, 1], watchedSeasonNumbers: [2, 9], episodeProgress: [
      { seasonNumber: 3, knownEpisodeNumbers: [3, 1], trackableEpisodeNumbers: [2, 1], watchedEpisodeNumbers: [2, 9] },
    ] },
    { tvId: 10, trackableSeasonNumbers: [4], watchedSeasonNumbers: [], episodeProgress: [] },
    { tvId: 0, trackableSeasonNumbers: [1], watchedSeasonNumbers: [1], episodeProgress: [] },
    { tvId: 30, trackableSeasonNumbers: 'bad', watchedSeasonNumbers: [], episodeProgress: [] },
    { tvId: 40, trackableSeasonNumbers: [1], watchedSeasonNumbers: [], episodeProgress: 'bad' },
  ]);

  assert.deepEqual(parseTvProgress(stored), { status: 'available', records: [
    { tvId: 10, trackableSeasonNumbers: [4], watchedSeasonNumbers: [], episodeProgress: [] },
    { tvId: 20, trackableSeasonNumbers: [1, 2, 3], watchedSeasonNumbers: [2, 3, 9], episodeProgress: [
      { seasonNumber: 3, knownEpisodeNumbers: [1, 2, 3], trackableEpisodeNumbers: [1, 2], watchedEpisodeNumbers: [1, 2, 9] },
    ] },
  ] });
});

test('derives trackable regular seasons using date-only local today', () => {
  const seasons = [
    { seasonNumber: 0, airDate: null },
    { seasonNumber: 4, airDate: null },
    { seasonNumber: 3, airDate: '2026-09-14' },
    { seasonNumber: 2, airDate: '2026-09-13' },
    { seasonNumber: 1, airDate: '2020-01-01' },
    { seasonNumber: 2, airDate: '2026-09-13' },
  ];

  assert.deepEqual(deriveTrackableSeasonNumbers(seasons, '2026-09-13'), [1, 2, 4]);
});

test('synchronizing totals retains stale watched seasons but excludes them from display', () => {
  const records = [{ tvId: 20, trackableSeasonNumbers: [1, 9], watchedSeasonNumbers: [1, 9], episodeProgress: [] }];
  const updated = synchronizeTrackableSeasons(records, 20, [2, 1, 2]);

  assert.deepEqual(updated, [
    { tvId: 20, trackableSeasonNumbers: [1, 2], watchedSeasonNumbers: [1, 9], episodeProgress: [] },
  ]);
  assert.deepEqual(calculateTvProgress(updated[0]), { watched: 1, total: 2 });
});

test('watched toggles ignore specials and keep deterministic sorted arrays', () => {
  const records = [{ tvId: 20, trackableSeasonNumbers: [1, 2, 3], watchedSeasonNumbers: [3], episodeProgress: [] }];
  const withOne = setSeasonWatched(records, 20, 1, true);
  const withoutThree = setSeasonWatched(withOne, 20, 3, false);

  assert.deepEqual(withOne[0].watchedSeasonNumbers, [1, 3]);
  assert.deepEqual(withoutThree[0].watchedSeasonNumbers, [1]);
  assert.deepEqual(setSeasonWatched(records, 20, 0, true), records);
});

test('derives known and trackable newest-season episodes from local calendar dates', () => {
  assert.deepEqual(deriveEpisodeMetadata(15, [
    { episodeNumber: 3, airDate: null },
    { episodeNumber: 2, airDate: '2026-09-14' },
    { episodeNumber: 1, airDate: '2026-09-13' },
    { episodeNumber: 1, airDate: '2026-09-13' },
    { episodeNumber: 0, airDate: '2026-09-01' },
  ], '2026-09-13'), {
    seasonNumber: 15,
    knownEpisodeNumbers: [1, 2, 3],
    trackableEpisodeNumbers: [1],
  });
});

test('synchronizes episode metadata while preserving stale watched values', () => {
  const records = [{
    tvId: 20,
    trackableSeasonNumbers: [1, 2],
    watchedSeasonNumbers: [1],
    episodeProgress: [{
      seasonNumber: 2,
      knownEpisodeNumbers: [1, 2],
      trackableEpisodeNumbers: [1],
      watchedEpisodeNumbers: [1, 9],
    }],
  }];
  const updated = synchronizeTrackingMetadata(records, 20, [1, 2], {
    seasonNumber: 2,
    knownEpisodeNumbers: [1, 2, 3],
    trackableEpisodeNumbers: [1, 2],
  });

  assert.deepEqual(findEpisodeProgress(updated[0], 2), {
    seasonNumber: 2,
    knownEpisodeNumbers: [1, 2, 3],
    trackableEpisodeNumbers: [1, 2],
    watchedEpisodeNumbers: [1, 9],
  });
});

test('converts a whole newest-season choice into watched aired episodes', () => {
  const records = [{
    tvId: 20,
    trackableSeasonNumbers: [1, 2],
    watchedSeasonNumbers: [1, 2],
    episodeProgress: [],
  }];
  const updated = synchronizeTrackingMetadata(records, 20, [1, 2], {
    seasonNumber: 2,
    knownEpisodeNumbers: [1, 2, 3],
    trackableEpisodeNumbers: [1, 2],
  });

  assert.deepEqual(updated, [{
    tvId: 20,
    trackableSeasonNumbers: [1, 2],
    watchedSeasonNumbers: [1],
    episodeProgress: [{
      seasonNumber: 2,
      knownEpisodeNumbers: [1, 2, 3],
      trackableEpisodeNumbers: [1, 2],
      watchedEpisodeNumbers: [1, 2],
    }],
  }]);
  assert.deepEqual(calculateTvProgress(updated[0]), { watched: 1, total: 2 });
});

test('episode toggles reject future episodes and complete a fully aired season', () => {
  const records = [{
    tvId: 20,
    trackableSeasonNumbers: [1, 2],
    watchedSeasonNumbers: [1],
    episodeProgress: [{
      seasonNumber: 2,
      knownEpisodeNumbers: [1, 2],
      trackableEpisodeNumbers: [1, 2],
      watchedEpisodeNumbers: [],
    }],
  }];
  const withOne = setEpisodeWatched(records, 20, 2, 1, true);
  const complete = setEpisodeWatched(withOne, 20, 2, 2, true);

  assert.deepEqual(setEpisodeWatched(records, 20, 2, 3, true), records);
  assert.deepEqual(calculateTvProgress(withOne[0]), { watched: 1, total: 2 });
  assert.deepEqual(calculateTvProgress(complete[0]), { watched: 2, total: 2 });
});

test('bulk episode changes affect aired episodes while retaining stale values', () => {
  const records = [{
    tvId: 20,
    trackableSeasonNumbers: [2],
    watchedSeasonNumbers: [],
    episodeProgress: [{
      seasonNumber: 2,
      knownEpisodeNumbers: [1, 2, 3],
      trackableEpisodeNumbers: [1, 2],
      watchedEpisodeNumbers: [1, 9],
    }],
  }];

  const watched = setAiredEpisodesWatched(records, 20, 2, true);
  assert.deepEqual(watched[0].episodeProgress[0].watchedEpisodeNumbers, [1, 2, 9]);
  const unwatched = setAiredEpisodesWatched(watched, 20, 2, false);
  assert.deepEqual(unwatched[0].episodeProgress[0].watchedEpisodeNumbers, [9]);
});

test('a season with future or unknown episodes is not complete when all aired episodes are watched', () => {
  const progress = {
    tvId: 20,
    trackableSeasonNumbers: [1, 2],
    watchedSeasonNumbers: [1, 2],
    episodeProgress: [{
      seasonNumber: 2,
      knownEpisodeNumbers: [1, 2],
      trackableEpisodeNumbers: [1],
      watchedEpisodeNumbers: [1],
    }],
  };

  assert.deepEqual(calculateTvProgress(progress), { watched: 1, total: 2 });
});

test('storage read errors and malformed data stay unavailable without a write-back', async () => {
  for (const getItem of [
    async () => { throw new Error('read failed'); },
    async () => '{broken',
  ]) {
    let writes = 0;
    const storage = createTvProgressStorage({
      getItem,
      setItem: async () => { writes += 1; },
    });
    const loaded = await storage.load();
    assert.equal(loaded.status, 'unavailable');
    await assert.rejects(() => storage.synchronize(20, [1, 2]));
    assert.equal(writes, 0);
  }
});

test('storage uses the versioned key, writes sorted data, and reports write failures', async () => {
  let savedKey = '';
  let savedValue = '';
  const storage = createTvProgressStorage({
    getItem: async () => '[]',
    setItem: async (key, value) => {
      savedKey = key;
      savedValue = value;
    },
  });

  await storage.synchronize(20, [3, 1, 3, 2]);
  assert.equal(savedKey, TV_PROGRESS_KEY);
  assert.deepEqual(JSON.parse(savedValue), [
    { tvId: 20, trackableSeasonNumbers: [1, 2, 3], watchedSeasonNumbers: [], episodeProgress: [] },
  ]);

  const failing = createTvProgressStorage({
    getItem: async () => savedValue,
    setItem: async () => { throw new Error('disk full'); },
  });
  await assert.rejects(() => failing.setSeasonWatched(20, 2, true), /disk full/);
});

test('a failed progress write restores the previous snapshot', async () => {
  const previous = [{ tvId: 20, trackableSeasonNumbers: [1, 2], watchedSeasonNumbers: [1], episodeProgress: [] }];
  const outcome = await commitTvProgressChange(previous, async () => {
    throw new Error('disk full');
  });

  assert.deepEqual(outcome, { saved: false, records: previous });
});

test('storage prefers v2, migrates v1 only when v2 is missing, and writes v2', async () => {
  const values = new Map([
    [TV_PROGRESS_KEY, null],
    [LEGACY_TV_PROGRESS_KEY, JSON.stringify([
      { tvId: 20, trackableSeasonNumbers: [1, 2], watchedSeasonNumbers: [1] },
    ])],
  ]);
  const writes = [];
  const storage = createTvProgressStorage({
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { writes.push([key, value]); },
  });

  assert.deepEqual(await storage.load(), { status: 'available', records: [{
    tvId: 20,
    trackableSeasonNumbers: [1, 2],
    watchedSeasonNumbers: [1],
    episodeProgress: [],
  }] });
  assert.equal(writes.length, 0);
  await storage.setEpisodeWatched(20, 2, 1, true);
  assert.equal(writes[0][0], TV_PROGRESS_KEY);
});

test('malformed v2 remains unavailable and never falls back to valid v1', async () => {
  let writes = 0;
  const storage = createTvProgressStorage({
    getItem: async (key) => key === TV_PROGRESS_KEY ? '{broken' : JSON.stringify([
      { tvId: 20, trackableSeasonNumbers: [1], watchedSeasonNumbers: [1] },
    ]),
    setItem: async () => { writes += 1; },
  });

  assert.deepEqual(await storage.load(), { status: 'unavailable', reason: 'malformed' });
  await assert.rejects(() => storage.synchronize(20, [1]));
  assert.equal(writes, 0);
});
