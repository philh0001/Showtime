import assert from 'node:assert/strict';
import test from 'node:test';
import { parseScheduleResponse } from '../src/services/schedule-response-rules.ts';

const valid = { schedule: { id: 12, title: 'Example', posterUrl: null,
  coverage: 'complete', seasonCoverage: [{ seasonNumber: 1, status: 'checked' }],
  nextEpisode: null, episodes: [{ id: 1, name: null, seasonNumber: 1, episodeNumber: 1, airDate: '2026-09-22' }] } };

test('accepts a bounded and internally consistent schedule response', () => {
  assert.equal(parseScheduleResponse(valid, 12)?.episodes[0].id, 1);
});

test('rejects wrong IDs, malformed dates, duplicate episodes and invalid coverage', () => {
  for (const schedule of [
    { ...valid.schedule, id: 13 },
    { ...valid.schedule, episodes: [{ ...valid.schedule.episodes[0], airDate: '2026-02-30' }] },
    { ...valid.schedule, episodes: [valid.schedule.episodes[0], valid.schedule.episodes[0]] },
    { ...valid.schedule, seasonCoverage: [{ seasonNumber: 1, status: 'maybe' }] },
    { ...valid.schedule, episodes: Array(201).fill(valid.schedule.episodes[0]) },
    { ...valid.schedule, coverage: 'complete', seasonCoverage: [{ seasonNumber: 1, status: 'unavailable' }] },
  ]) assert.equal(parseScheduleResponse({ schedule }, 12), null);
});
