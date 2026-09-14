import assert from 'node:assert/strict';
import test from 'node:test';

import { getHomeLayout } from '../src/services/home-layout-rules.ts';

test('phone Home keeps one module column and compacts sparse collections', () => {
  assert.deepEqual(getHomeLayout(390, 1), {
    moduleColumns: 1,
    collectionMode: 'compact',
  });
  assert.equal(getHomeLayout(390, 2).collectionMode, 'compact');
});

test('wide Home balances modules while populated collections remain poster rails', () => {
  assert.deepEqual(getHomeLayout(768, 3), {
    moduleColumns: 2,
    collectionMode: 'rail',
  });
  assert.equal(getHomeLayout(1280, 8).moduleColumns, 2);
});
