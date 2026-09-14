import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getProfileColumns,
  getWatchlistColumns,
} from '../src/services/collection-layout-rules.ts';

test('collection layouts remain single-column on narrow screens', () => {
  assert.equal(getWatchlistColumns(599), 1);
  assert.equal(getProfileColumns(599), 1);
});

test('Watchlist scales to a bounded grid while Profile stays readable', () => {
  assert.equal(getWatchlistColumns(600), 2);
  assert.equal(getWatchlistColumns(900), 3);
  assert.equal(getWatchlistColumns(1200), 4);
  assert.equal(getWatchlistColumns(2400), 4);
  assert.equal(getProfileColumns(600), 2);
  assert.equal(getProfileColumns(1600), 2);
});
