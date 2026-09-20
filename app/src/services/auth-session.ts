import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AccountUser } from './account-api';

// Persists the signed-in session across app restarts. The token is a bearer
// token (see account-api.ts); it is not a password and is always revocable
// server-side via /auth/logout, so plain AsyncStorage is an acceptable place
// to keep it given this app has no other secure-storage dependency yet.
const SESSION_KEY = 'showtime.account-session.v1';

export type StoredSession = { sessionToken: string; user: AccountUser };

export async function loadStoredSession(): Promise<StoredSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.sessionToken === 'string' && parsed.user) return parsed as StoredSession;
  } catch {
    // Fall through to null below.
  }
  return null;
}

export async function saveStoredSession(session: StoredSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearStoredSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}
