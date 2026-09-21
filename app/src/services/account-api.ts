import { getServerUrl } from './server-url';

// Thin fetch wrapper for the Worker's /auth/* and /sync/* routes. Every
// response is JSON (even errors), so callers get a parsed body plus status.
export type ApiResponse<T> = { ok: boolean; status: number; body: T };

async function request<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<ApiResponse<T>> {
  const { token, headers, ...rest } = init;
  const finalHeaders = new Headers(headers);
  if (rest.body && !finalHeaders.has('Content-Type')) finalHeaders.set('Content-Type', 'application/json');
  if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${getServerUrl()}${path}`, { ...rest, headers: finalHeaders });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = null; }
  }
  return { ok: response.ok, status: response.status, body: body as T };
}

export type AccountUser = { id: string; email: string; emailVerified: boolean };

export function signup(email: string, password: string) {
  return request<{ user: AccountUser; sessionToken: string; devVerificationToken?: string; error?: string }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function login(email: string, password: string) {
  return request<{ user: AccountUser; sessionToken: string; error?: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logout(token: string) {
  return request<null>('/auth/logout', { method: 'POST', token });
}

export function fetchSession(token: string) {
  return request<{ user: AccountUser; error?: string }>('/auth/session', { token });
}

export function verifyEmail(token: string) {
  return request<{ verified: boolean; error?: string }>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export function requestPasswordReset(email: string) {
  return request<{ requested: boolean; devResetToken?: string; error?: string }>('/auth/request-reset', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, password: string) {
  return request<{ reset: boolean; error?: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

export type SyncCollection = 'watchlist' | 'movie-progress' | 'tv-progress' | 'viewing-activity' | 'settings';
export type SyncPullBody = { collections: Record<string, { data: unknown; updatedAt: string; revision: number }>; error?: string };

export function syncPull(token: string) {
  return request<SyncPullBody>('/sync/pull', { token });
}

export function syncPush(token: string, collection: SyncCollection, data: unknown, expectedRevision: number | null) {
  return request<{ collection: string; updatedAt: string; revision: number; error?: string }>('/sync/push', {
    method: 'POST',
    token,
    body: JSON.stringify({ collection, data, expectedRevision }),
  });
}
