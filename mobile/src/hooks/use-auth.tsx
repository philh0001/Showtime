import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import * as authService from '@/services/auth';
import type { AccountUser } from '@/services/account-api';
import type { StoredSession } from '@/services/auth-session';
import { runSync } from '@/services/sync';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  status: AuthStatus;
  user: AccountUser | null;
  syncing: boolean;
  lastSyncError: string | null;
  signUp: (email: string, password: string) => Promise<authService.AuthResult>;
  signIn: (email: string, password: string) => Promise<authService.AuthResult>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  syncNow: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AccountUser | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const sessionRef = useRef<StoredSession | null>(null);

  const syncNow = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || !session.user.emailVerified) return;
    setSyncing(true);
    const outcome = await runSync(session.sessionToken);
    setSyncing(false);
    setLastSyncError(outcome.ok ? null : outcome.error);
  }, []);

  const applySession = useCallback((session: StoredSession | null) => {
    sessionRef.current = session;
    setUser(session?.user ?? null);
    setStatus(session ? 'signedIn' : 'signedOut');
  }, []);

  const refresh = useCallback(async () => {
    const session = await authService.restoreSession();
    applySession(session);
    if (session) void syncNow();
  }, [applySession, syncNow]);

  useEffect(() => {
    // Intentionally runs once on mount; restoring the persisted session is
    // async, so no setState call happens synchronously within this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && sessionRef.current) void syncNow();
    });
    return () => subscription.remove();
  }, [syncNow]);

  const signUp = useCallback(async (email: string, password: string) => {
    const result = await authService.signUp(email, password);
    if (result.ok) applySession(result.session);
    return result;
  }, [applySession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await authService.signIn(email, password);
    if (result.ok) {
      applySession(result.session);
      void syncNow();
    }
    return result;
  }, [applySession, syncNow]);

  const signOut = useCallback(async () => {
    await authService.signOut(sessionRef.current);
    applySession(null);
  }, [applySession]);

  const value = useMemo<AuthContextValue>(() => ({
    status, user, syncing, lastSyncError, signUp, signIn, signOut, refresh, syncNow,
  }), [status, user, syncing, lastSyncError, signUp, signIn, signOut, refresh, syncNow]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider.');
  return context;
}
