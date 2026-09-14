import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canToggleEpisodeExpansion,
  getDetailsLayout,
  getInitialEpisodeExpansion,
} from '../src/services/tv-tracking-layout-rules.ts';

test('short episode lists stay visible while long lists start collapsed', () => {
  assert.equal(getInitialEpisodeExpansion(0), false);
  assert.equal(getInitialEpisodeExpansion(6), true);
  assert.equal(getInitialEpisodeExpansion(7), false);
  assert.equal(canToggleEpisodeExpansion(6), false);
  assert.equal(canToggleEpisodeExpansion(7), true);
});

test('details stack on narrow screens and split when enough width is available', () => {
  assert.equal(getDetailsLayout(899), 'stacked');
  assert.equal(getDetailsLayout(900), 'split');
  assert.equal(getDetailsLayout(1440), 'split');
});
