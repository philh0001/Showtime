import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import * as authService from '@/services/auth';
import type { AccountUser } from '@/services/account-api';
import type { StoredSession } from '@/services/auth-session';
import { runSync } from '@/services/sync';
import { publishLibraryChange, subscribeLibraryChanges } from '@/services/library-changes';

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
  const syncRef = useRef<Promise<void> | null>(null);
  const syncAgainRef = useRef(false);
  const refreshRef = useRef<Promise<void> | null>(null);

  const syncNow = useCallback((): Promise<void> => {
    if (syncRef.current) {
      syncAgainRef.current = true;
      return syncRef.current;
    }
    if (!sessionRef.current?.user.emailVerified) return Promise.resolve();
    const task = (async () => {
      setSyncing(true);
      try {
        do {
          syncAgainRef.current = false;
          const session = sessionRef.current;
          if (!session?.user.emailVerified) break;
          const outcome = await runSync(session.sessionToken, session.user.id);
          if (sessionRef.current?.user.id === session.user.id) {
            setLastSyncError(outcome.ok ? null : outcome.error);
            if (outcome.ok && outcome.synced.length > 0) publishLibraryChange('remote');
          }
        } while (syncAgainRef.current);
      } catch {
        setLastSyncError('Could not reach the sync service.');
      } finally {
        setSyncing(false);
      }
    })();
    syncRef.current = task;
    void task.finally(() => { syncRef.current = null; });
    return task;
  }, []);

  const applySession = useCallback((session: StoredSession | null) => {
    sessionRef.current = session;
    setUser(session?.user ?? null);
    setStatus(session ? 'signedIn' : 'signedOut');
  }, []);

  const refresh = useCallback((): Promise<void> => {
    if (refreshRef.current) return refreshRef.current;
    const task = (async () => {
      try {
        const session = await authService.restoreSession();
        applySession(session);
        if (session) await syncNow();
      } catch {
        if (!sessionRef.current) applySession(null);
        setLastSyncError('Could not read your account status.');
      }
    })();
    refreshRef.current = task;
    void task.finally(() => { refreshRef.current = null; });
    return task;
  }, [applySession, syncNow]);

  useEffect(() => {
    // Intentionally runs once on mount; restoring the persisted session is
    // async, so no setState call happens synchronously within this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const onResume = () => {
        if (document.visibilityState === 'visible' && sessionRef.current) void refresh();
      };
      document.addEventListener('visibilitychange', onResume);
      window.addEventListener('focus', onResume);
      return () => {
        document.removeEventListener('visibilitychange', onResume);
        window.removeEventListener('focus', onResume);
      };
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && sessionRef.current) void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeLibraryChanges((origin) => {
      if (origin !== 'local' || !sessionRef.current?.user.emailVerified) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; void syncNow(); }, 750);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
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
    setLastSyncError(null);
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
