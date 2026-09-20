import assert from 'node:assert/strict';
import test from 'node:test';
import { createSettingsStorage } from '../src/services/settings-storage.ts';

test('settings default to trending enabled and persist an explicit opt-out', async () => {
  let stored = null;
  const storage = createSettingsStorage({ getItem: async () => stored, setItem: async (_key, value) => { stored = value; } });
  assert.deepEqual(await storage.load(), { status: 'available', showTrending: true });
  await storage.setShowTrending(false);
  assert.deepEqual(await storage.load(), { status: 'available', showTrending: false });
});

test('unreadable settings are unavailable and never overwritten by a toggle', async () => {
  for (const stored of ['{bad', '[]', '{"showTrending":"false"}']) {
    const storage = createSettingsStorage({ getItem: async () => stored, setItem: async () => assert.fail('must not write') });
    assert.deepEqual(await storage.load(), { status: 'unavailable' });
    await assert.rejects(storage.setShowTrending(false));
  }
});

test('failed setting writes leave the saved preference unchanged', async () => {
  const storage = createSettingsStorage({ getItem: async () => '{"showTrending":true}', setItem: async () => { throw new Error('write'); } });
  await assert.rejects(storage.setShowTrending(false));
  assert.deepEqual(await storage.load(), { status: 'available', showTrending: true });
});

test('focus reads during a slow settings write wait for the saved preference', async () => {
  let stored = '{"showTrending":true}';
  let release;
  let started;
  const writing = new Promise((resolve) => { started = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  const storage = createSettingsStorage({
    getItem: async () => stored,
    setItem: async (_key, value) => { started(); await gate; stored = value; },
  });
  const save = storage.setShowTrending(false);
  await writing;
  const focusRead = storage.load();
  release();
  await save;
  assert.deepEqual(await focusRead, { status: 'available', showTrending: false });
});
