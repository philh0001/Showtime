import assert from 'node:assert/strict';
import test from 'node:test';

import { createNotifyingStorage, publishLibraryChange, subscribeLibraryChanges } from '../src/services/library-changes.ts';

test('successful local writes announce a change that can schedule sync', async () => {
  const events = [];
  const unsubscribe = subscribeLibraryChanges((origin) => events.push(origin));
  const storage = createNotifyingStorage({
    setItem: async () => undefined,
    getItem: async () => null,
    removeItem: async () => undefined,
  });
  await storage.setItem('library', '[]');
  publishLibraryChange('remote');
  unsubscribe();
  await storage.removeItem('library');
  assert.deepEqual(events, ['local', 'remote']);
});

test('failed local writes do not announce a change', async () => {
  const events = [];
  const unsubscribe = subscribeLibraryChanges((origin) => events.push(origin));
  const storage = createNotifyingStorage({
    setItem: async () => { throw new Error('disk full'); },
    getItem: async () => null,
    removeItem: async () => undefined,
  });
  await assert.rejects(storage.setItem('library', '[]'));
  unsubscribe();
  assert.deepEqual(events, []);
});
