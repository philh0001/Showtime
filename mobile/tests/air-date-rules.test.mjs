import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatUkDate,
  getCountdownLabel,
  getDeviceLocalIsoDate,
  getSeasonAirDateLabel,
  normalizeNextEpisode,
  parseIsoCalendarDate,
  selectNextEpisode,
} from '../src/services/air-date-rules.ts';

const episode = {
  id: 10,
  name: 'Return',
  seasonNumber: 3,
  episodeNumber: 2,
  airDate: '2026-09-15',
};

test('validates real ISO calendar dates without accepting overflow dates', () => {
  assert.deepEqual(parseIsoCalendarDate('2024-02-29'), { year: 2024, month: 2, day: 29 });
  assert.equal(parseIsoCalendarDate('2023-02-29'), null);
  assert.equal(parseIsoCalendarDate('2026-02-30'), null);
  assert.equal(parseIsoCalendarDate('2026-2-03'), null);
  assert.equal(parseIsoCalendarDate('not-a-date'), null);
});

test('formats valid dates using UK day-month-year order', () => {
  assert.equal(formatUkDate('2026-10-07'), '07/10/2026');
  assert.equal(formatUkDate('2026-02-30'), null);
  assert.equal(formatUkDate(null), null);
});

test('reads today from local date components rather than UTC components', () => {
  const localDate = new Date(2026, 8, 13, 23, 30);
  assert.equal(getDeviceLocalIsoDate(localDate), '2026-09-13');
});

test('creates date-only countdown labels across month and year boundaries', () => {
  assert.equal(getCountdownLabel('2026-09-13', '2026-09-13'), 'Airs today');
  assert.equal(getCountdownLabel('2026-10-01', '2026-09-30'), 'Airs tomorrow');
  assert.equal(getCountdownLabel('2027-01-03', '2026-12-30'), 'Airs in 4 days');
  assert.equal(getCountdownLabel(null, '2026-09-13'), 'No upcoming episode announced');
  assert.equal(getCountdownLabel('broken', '2026-09-13'), 'No upcoming episode announced');
});

test('mobile keeps current/future candidates and hides past or malformed candidates', () => {
  assert.deepEqual(normalizeNextEpisode(episode, '2026-09-13'), episode);
  assert.deepEqual(normalizeNextEpisode({ ...episode, airDate: '2026-09-13' }, '2026-09-13'), {
    ...episode, airDate: '2026-09-13',
  });
  assert.equal(normalizeNextEpisode({ ...episode, airDate: '2026-09-12' }, '2026-09-13'), null);
  assert.equal(normalizeNextEpisode({ ...episode, airDate: '2026-02-30' }, '2026-01-01'), null);
  assert.equal(normalizeNextEpisode({ ...episode, id: 0 }, '2026-09-13'), null);
  assert.equal(normalizeNextEpisode(null, '2026-09-13'), null);
});

test('prefers a valid TMDB next episode over season-list candidates', () => {
  const primary = { ...episode, id: 10, episodeNumber: 8, airDate: '2026-09-20' };
  const candidates = [
    { ...episode, id: 11, episodeNumber: 2, airDate: '2026-09-15' },
  ];

  assert.deepEqual(selectNextEpisode(primary, candidates, '2026-09-13'), primary);
});

test('falls back to the earliest valid non-past newest-season episode', () => {
  const candidates = [
    { ...episode, id: 15, episodeNumber: 5, airDate: null },
    { ...episode, id: 14, episodeNumber: 4, airDate: 'broken' },
    { ...episode, id: 13, episodeNumber: 3, airDate: '2026-09-20' },
    { ...episode, id: 11, episodeNumber: 1, airDate: '2026-09-15' },
    { ...episode, id: 12, episodeNumber: 2, airDate: '2026-09-15' },
  ];

  assert.deepEqual(
    selectNextEpisode({ ...episode, airDate: '2026-09-12' }, candidates, '2026-09-13'),
    { ...episode, id: 11, episodeNumber: 1, airDate: '2026-09-15' },
  );
  assert.equal(selectNextEpisode(null, [{ ...episode, airDate: '2026-09-12' }], '2026-09-13'), null);
});

test('labels season dates with exact UK calendar dates', () => {
  assert.equal(getSeasonAirDateLabel('2026-10-07', '2026-09-13'), 'Starts 07/10/2026');
  assert.equal(getSeasonAirDateLabel('2025-10-01', '2026-09-13'), 'Premiered 01/10/2025');
  assert.equal(getSeasonAirDateLabel('broken', '2026-09-13'), 'Air date unavailable');
  assert.equal(getSeasonAirDateLabel(null, '2026-09-13'), 'Air date unavailable');
});
