import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeDetailExtras } from '../src/services/detail-extras-rules.ts';

test('missing detail extras remain compatible with older local servers', () => {
  assert.deepEqual(normalizeDetailExtras({}), { cast: [], crew: [], trailer: null });
});

test('detail extras reject unsafe trailer destinations and malformed people', () => {
  const data = normalizeDetailExtras({ cast: [null, { id: -1, name: 'Bad' },
    { id: 1, name: 'Actor', character: 'Hero', profileUrl: 'https://image.tmdb.org/t/p/w185/photo.jpg' }],
  crew: [{ id: 2, name: 'Writer', job: 'Writer' }], trailer: { name: 'Bad', url: 'javascript:alert(1)' } });
  assert.equal(data.cast.length, 1);
  assert.equal(data.crew.length, 1);
  assert.equal(data.trailer, null);
  assert.equal(normalizeDetailExtras({ trailer: { name: 'Trailer', url: 'https://www.youtube.com/watch?v=A1b2C3d4E5f' } }).trailer.url,
    'https://www.youtube.com/watch?v=A1b2C3d4E5f');
});
