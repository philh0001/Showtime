import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveStoredSession } from '../src/services/auth-restoration.ts';

const stored = { sessionToken: 'saved-token', user: { id: 'u1', email: 'a@example.com', emailVerified: true } };

test('a network failure or server outage keeps the saved account available locally', () => {
  assert.deepEqual(resolveStoredSession(stored, null), { session: stored, clear: false });
  assert.deepEqual(resolveStoredSession(stored, { ok: false, status: 503, body: { error: 'offline' } }),
    { session: stored, clear: false });
});

test('an expired session is removed only after a definite unauthorized response', () => {
  assert.deepEqual(resolveStoredSession(stored, { ok: false, status: 401, body: { error: 'expired' } }),
    { session: null, clear: true });
});

test('a valid response refreshes the cached account state', () => {
  const verified = { ...stored.user, emailVerified: false };
  assert.deepEqual(resolveStoredSession(stored, { ok: true, status: 200, body: { user: verified } }),
    { session: { sessionToken: 'saved-token', user: verified }, clear: false });
});
