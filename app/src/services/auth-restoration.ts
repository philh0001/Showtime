import type { AccountUser, ApiResponse } from './account-api';
import type { StoredSession } from './auth-session';

type SessionResponse = ApiResponse<{ user?: AccountUser; error?: string }>;

export function resolveStoredSession(
  stored: StoredSession, response: SessionResponse | null,
): { session: StoredSession | null; clear: boolean } {
  if (response?.status === 401) return { session: null, clear: true };
  const user = response?.body?.user;
  if (response?.ok && user && typeof user.id === 'string' && typeof user.email === 'string'
    && typeof user.emailVerified === 'boolean') {
    return { session: { sessionToken: stored.sessionToken, user }, clear: false };
  }
  return { session: stored, clear: false };
}
