import assert from 'node:assert/strict';
import test from 'node:test';
import { createNotificationPreferences } from '../src/services/notification-preferences.ts';

test('notification reminders default off and persist safely', async () => {
  let value = null;
  const preferences = createNotificationPreferences({
    getItem: async () => value,
    setItem: async (_key, next) => { value = next; },
  }, { scheduledRemindersAvailable: true });
  assert.deepEqual(await preferences.load(), { status: 'available', preferences: { remindersEnabled: false } });
  await preferences.setRemindersEnabled(true);
  assert.deepEqual(await preferences.load(), { status: 'available', preferences: { remindersEnabled: true } });
});

test('malformed notification preferences are unavailable', async () => {
  const preferences = createNotificationPreferences(
    { getItem: async () => '{"remindersEnabled":"yes"}', setItem: async () => {} },
    { scheduledRemindersAvailable: true },
  );
  assert.deepEqual(await preferences.load(), { status: 'unavailable' });
  await assert.rejects(preferences.setRemindersEnabled(false), /unavailable/);
});

test('reminders cannot be enabled when scheduling support is absent', async () => {
  let value = null;
  const preferences = createNotificationPreferences({
    getItem: async () => value,
    setItem: async (_key, next) => { value = next; },
  });

  assert.deepEqual(await preferences.load(), {
    status: 'unsupported',
    preferences: { remindersEnabled: false },
  });
  await assert.rejects(preferences.setRemindersEnabled(true), /not available/i);
  assert.equal(value, null);
});
