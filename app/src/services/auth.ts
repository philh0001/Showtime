import * as accountApi from './account-api';
import { clearStoredSession, loadStoredSession, saveStoredSession, type StoredSession } from './auth-session';

export type AuthResult = { ok: true; session: StoredSession; devVerificationToken?: string } | { ok: false; error: string };

function genericError(fallback: string) {
  return { ok: false as const, error: fallback };
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const response = await accountApi.signup(email, password);
  if (!response.ok) return genericError(response.body?.error ?? 'Could not create an account.');
  const session: StoredSession = { sessionToken: response.body.sessionToken, user: response.body.user };
  await saveStoredSession(session);
  return { ok: true, session, devVerificationToken: response.body.devVerificationToken };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const response = await accountApi.login(email, password);
  if (!response.ok) return genericError(response.body?.error ?? 'Incorrect email or password.');
  const session: StoredSession = { sessionToken: response.body.sessionToken, user: response.body.user };
  await saveStoredSession(session);
  return { ok: true, session };
}

export async function signOut(session: StoredSession | null): Promise<void> {
  if (session) await accountApi.logout(session.sessionToken).catch(() => undefined);
  await clearStoredSession();
}

export async function restoreSession(): Promise<StoredSession | null> {
  const stored = await loadStoredSession();
  if (!stored) return null;
  const response = await accountApi.fetchSession(stored.sessionToken);
  if (!response.ok) {
    await clearStoredSession();
    return null;
  }
  const refreshed: StoredSession = { sessionToken: stored.sessionToken, user: response.body.user };
  await saveStoredSession(refreshed);
  return refreshed;
}

export async function verifyEmail(token: string): Promise<{ ok: boolean; error?: string }> {
  const response = await accountApi.verifyEmail(token);
  if (!response.ok) return { ok: false, error: response.body?.error ?? 'This verification link is invalid or has expired.' };
  return { ok: true };
}

export async function requestPasswordReset(email: string): Promise<{ ok: boolean; devResetToken?: string; error?: string }> {
  const response = await accountApi.requestPasswordReset(email);
  if (!response.ok) return { ok: false, error: response.body?.error ?? 'Could not request a password reset.' };
  return { ok: true, devResetToken: response.body.devResetToken };
}

export async function resetPassword(token: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const response = await accountApi.resetPassword(token, password);
  if (!response.ok) return { ok: false, error: response.body?.error ?? 'This reset link is invalid or has expired.' };
  return { ok: true };
}
