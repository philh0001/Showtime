import assert from 'node:assert/strict';
import test from 'node:test';

import { getProfileActivityPreview, formatActivityAge } from '../src/services/profile-activity.ts';

const title = { id: 12, mediaType: 'TV', title: 'Example Show', year: '2024', posterUrl: null };
const event = (sequence, happenedAt) => ({
  id: `event-${sequence}`, sequence, title,
  action: { kind: 'episode', seasonNumber: 1, episodeNumber: sequence, watched: true },
  happenedAt,
});

test('profile shows the latest three activity events even when input order changes', () => {
  const records = [
    event(1, '2026-09-18T12:00:00.000Z'),
    event(4, '2026-09-21T12:00:00.000Z'),
    event(2, '2026-09-19T12:00:00.000Z'),
    event(3, '2026-09-20T12:00:00.000Z'),
  ];
  assert.deepEqual(getProfileActivityPreview(records).map(({ sequence }) => sequence), [4, 3, 2]);
  assert.deepEqual(records.map(({ sequence }) => sequence), [1, 4, 2, 3]);
});

test('profile activity ages remain readable for recent, older, and future events', () => {
  const now = new Date('2026-09-21T12:00:00.000Z');
  assert.equal(formatActivityAge('2026-09-21T11:58:00.000Z', now), 'Just now');
  assert.equal(formatActivityAge('2026-09-21T09:00:00.000Z', now), '3 hours ago');
  assert.equal(formatActivityAge('2026-09-19T12:00:00.000Z', now), '2 days ago');
  assert.equal(formatActivityAge('2026-09-14T12:00:00.000Z', now), '1 week ago');
  assert.equal(formatActivityAge('2026-09-22T12:00:00.000Z', now), 'Just now');
});
