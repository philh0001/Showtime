import { Link, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandColors, ControlSize, Layout, Radii, Space } from '@/constants/design';
import { useAuth } from '@/hooks/use-auth';
import type { AccountUser } from '@/services/account-api';
import { requestPasswordReset, resetPassword } from '@/services/auth';
import { loadHomeData, type HomeData } from '@/services/home-data';
import { subscribeLibraryChanges } from '@/services/library-changes';
import { loadMovieProgress } from '@/services/movie-progress';
import { loadRecentlyViewed } from '@/services/recently-viewed';
import { loadTvProgress } from '@/services/tv-progress';
import { loadTvSchedules } from '@/services/tv-schedule';
import { getViewingStats } from '@/services/viewing-summary';
import { loadWatchlist } from '@/services/watchlist';

type Mode = 'sign-in' | 'sign-up' | 'forgot' | 'reset';

export default function AccountScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = Math.max(0, Math.min(windowWidth - Layout.phonePadding * 2, 560));
  const router = useRouter();
  const { mode: requestedMode } = useLocalSearchParams<{ mode?: string }>();
  const { status, user, signIn, signUp, signOut, refresh, syncing, lastSyncError, syncNow } = useAuth();
  const [mode, setMode] = useState<Mode>(requestedMode === 'sign-up' ? 'sign-up' : 'sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);

  useEffect(() => {
    if (requestedMode === 'sign-up' || requestedMode === 'sign-in') {
      // The same Account route can be opened from either desktop header action.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode(requestedMode);
    }
  }, [requestedMode]);

  async function submitSignIn() {
    setBusy(true); setError(null); setNotice(null);
    const result = await signIn(email.trim(), password);
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setPassword('');
    router.replace('/');
  }

  async function submitSignUp() {
    setBusy(true); setError(null); setNotice(null);
    const result = await signUp(email.trim(), password);
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setPassword('');
    router.replace('/?welcome=account-created');
  }

  async function submitForgot() {
    setBusy(true); setError(null); setNotice(null); setDevToken(null);
    const result = await requestPasswordReset(email.trim());
    setBusy(false);
    if (!result.ok) { setError(result.error ?? 'Could not request a reset.'); return; }
    setNotice('If that email has an account, check your inbox for a reset link.');
    if (result.devResetToken) setDevToken(result.devResetToken);
    setMode('reset');
  }

  async function submitReset() {
    setBusy(true); setError(null); setNotice(null);
    const result = await resetPassword(resetToken.trim(), newPassword);
    setBusy(false);
    if (!result.ok) { setError(result.error ?? 'Could not reset the password.'); return; }
    setResetToken(''); setNewPassword('');
    setNotice('Password reset. Sign in with your new password.');
    setMode('sign-in');
  }

  if (status === 'signedIn' && user) {
    return <SignedInAccount user={user} contentWidth={contentWidth} syncing={syncing} lastSyncError={lastSyncError}
      refresh={refresh} syncNow={syncNow} signOut={signOut} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { width: contentWidth }]}>
        <Text accessibilityRole="header" style={styles.title}>
          {mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : mode === 'forgot' ? 'Reset password' : 'New password'}
        </Text>
        {mode !== 'sign-in' && <Text style={styles.subtitle}>
          {mode === 'sign-up' ? 'Save your Watchlist and viewing progress to your account. Verify your email to use them on another device.'
            : mode === 'forgot' ? 'Enter your email and we’ll send a link to reset your password.'
              : 'Enter the code from your reset link, then choose a new password.'}
        </Text>}

        <View style={styles.form}>

        {(mode === 'sign-in' || mode === 'sign-up' || mode === 'forgot') && (
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={BrandColors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            accessibilityLabel="Email"
            style={styles.input}
          />
        )}
        {(mode === 'sign-in' || mode === 'sign-up') && (
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={BrandColors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            accessibilityLabel="Password"
            style={styles.input}
          />
        )}
        {mode === 'reset' && (
          <>
            <TextInput
              value={resetToken}
              onChangeText={setResetToken}
              placeholder="Reset token"
              placeholderTextColor={BrandColors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password"
              placeholderTextColor={BrandColors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              style={styles.input}
            />
          </>
        )}

        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {notice && <Text style={styles.notice}>{notice}</Text>}
        {devToken && <Text style={styles.devToken}>Reset code for this local test: {devToken}</Text>}

        {mode === 'sign-in' && <PrimaryButton label={busy ? 'Signing in…' : 'Sign in'} onPress={() => void submitSignIn()} disabled={busy || !email.trim() || !password} />}
        {mode === 'sign-up' && <PrimaryButton label={busy ? 'Creating account…' : 'Create account'} onPress={() => void submitSignUp()} disabled={busy || !email.trim() || !password} />}
        {mode === 'forgot' && <PrimaryButton label={busy ? 'Requesting…' : 'Send reset link'} onPress={() => void submitForgot()} disabled={busy || !email.trim()} />}
        {mode === 'reset' && <PrimaryButton label={busy ? 'Resetting…' : 'Reset password'} onPress={() => void submitReset()} disabled={busy || !resetToken.trim() || !newPassword} />}
        </View>

        <View style={styles.links}>
          {mode === 'sign-in' && <>
            <Pressable accessibilityRole="button" onPress={() => { setMode('sign-up'); setError(null); setNotice(null); }} style={styles.linkButton}><Text style={styles.link}>Create an account</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setMode('forgot'); setError(null); setNotice(null); }} style={styles.linkButton}><Text style={styles.link}>Forgot password?</Text></Pressable>
          </>}
          {mode !== 'sign-in' && <Pressable accessibilityRole="button" onPress={() => { setMode('sign-in'); setError(null); setNotice(null); }} style={styles.linkButton}><Text style={styles.link}>Back to sign in</Text></Pressable>}
          {mode === 'reset' && <Pressable accessibilityRole="button" onPress={() => { setMode('forgot'); setError(null); setNotice(null); }} style={styles.linkButton}><Text style={styles.link}>Request another link</Text></Pressable>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SignedInAccount({ user, contentWidth, syncing, lastSyncError, refresh, syncNow, signOut }: {
  user: AccountUser;
  contentWidth: number;
  syncing: boolean;
  lastSyncError: string | null;
  refresh: () => Promise<void>;
  syncNow: () => Promise<void>;
  signOut: () => Promise<void>;
}) {
  const [library, setLibrary] = useState<HomeData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    async function loadLibrary() {
      const next = await loadHomeData({ loadRecentlyViewed, loadWatchlist, loadMovieProgress, loadTvProgress, loadTvSchedules });
      if (active) setLibrary(next);
    }
    void loadLibrary();
    const unsubscribe = subscribeLibraryChanges(() => { void loadLibrary(); });
    return () => { active = false; unsubscribe(); };
  }, []));

  const stats = library ? getViewingStats(library.watchlist, library.movieProgress, library.tvProgress) : null;
  const syncStatus = !user.emailVerified ? 'Waiting for verification'
    : syncing ? 'Syncing…' : lastSyncError ? 'Needs attention' : 'Enabled';

  async function refreshStatus() {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  }

  return <SafeAreaView style={styles.container}>
    <ScrollView contentContainerStyle={[styles.content, { width: contentWidth }]}>
      <Text accessibilityRole="header" style={styles.title}>Your account</Text>
      <View style={styles.banner}>
        <Text style={styles.sectionHeading}>Signed in as</Text>
        <Text style={styles.email}>{user.email}</Text>
        <AccountRow label="Email verification" value={user.emailVerified ? 'Verified' : 'Pending'} />
        <AccountRow label="Cloud sync" value={syncStatus} />
      </View>

      {!user.emailVerified && <View style={styles.banner}>
        <Text style={styles.bannerText}>Open the verification link in your email, then refresh your account status here.</Text>
        <PrimaryButton label={refreshing ? 'Refreshing…' : 'Refresh account status'} onPress={() => void refreshStatus()} disabled={refreshing} />
      </View>}
      {user.emailVerified && <View style={styles.section}>
        <PrimaryButton label={syncing ? 'Syncing…' : 'Sync now'} onPress={() => void syncNow()} disabled={syncing} />
        {lastSyncError && <Text accessibilityRole="alert" style={styles.error}>{lastSyncError}</Text>}
      </View>}

      <View style={styles.banner}>
        <Text accessibilityRole="header" style={styles.sectionHeading}>Library on this device</Text>
        <Text style={styles.subtitle}>{user.emailVerified
          ? 'These counts are from this device. Your account can also store this library.'
          : 'These counts are from this device. Verify your email to save this library to your account.'}</Text>
        <AccountRow label="Watchlist titles" value={displayCount(stats?.watchlist)} />
        <AccountRow label="Movies watched" value={displayCount(stats?.moviesWatched)} />
        <AccountRow label="Shows with progress" value={displayCount(stats?.showsTracked)} />
        <View style={styles.accountLinks}>
          <Link href="/watchlist" style={styles.link}>Open Watchlist</Link>
          <Link href="/history" style={styles.link}>View viewing history</Link>
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.secondaryButton}>
        <Text style={styles.secondaryText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  </SafeAreaView>;
}

function displayCount(count: number | null | undefined) {
  return count === null || count === undefined ? 'Unavailable' : String(count);
}

function AccountRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.accountRow}>
    <Text style={styles.accountLabel}>{label}</Text>
    <Text style={styles.accountValue}>{value}</Text>
  </View>;
}

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={[styles.primaryButton, disabled && styles.primaryDisabled]}>
      {disabled && label.endsWith('…') ? <ActivityIndicator color={BrandColors.onGold} /> : <Text style={styles.primaryText}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BrandColors.background },
  content: { alignSelf: 'center', paddingTop: Space.lg, paddingBottom: Space.xxl, gap: Space.lg },
  title: { color: BrandColors.text, fontSize: 28, fontWeight: '800' },
  subtitle: { color: BrandColors.textMuted, fontSize: 15, lineHeight: 22 },
  form: { backgroundColor: BrandColors.surfaceRaised, borderRadius: Radii.md, borderWidth: 1,
    borderColor: BrandColors.border, padding: Space.lg, gap: Space.md },
  input: {
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: Radii.md,
    minHeight: ControlSize.search,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    color: BrandColors.text,
    fontSize: 16,
  },
  primaryButton: { backgroundColor: BrandColors.gold, borderRadius: Radii.md, minHeight: ControlSize.search,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: Space.lg },
  primaryDisabled: { opacity: 0.6 },
  primaryText: { color: BrandColors.onGold, fontSize: 16, fontWeight: '700' },
  secondaryButton: { minHeight: ControlSize.minimum, justifyContent: 'center', alignItems: 'center' },
  secondaryText: { color: BrandColors.danger, fontSize: 15, fontWeight: '700' },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.lg },
  linkButton: { minHeight: ControlSize.minimum, justifyContent: 'center' },
  link: { color: BrandColors.goldBright, fontSize: 15, fontWeight: '700' },
  error: { color: BrandColors.danger, fontSize: 14, lineHeight: 20 },
  notice: { color: BrandColors.success, fontSize: 14, lineHeight: 20 },
  devToken: { color: BrandColors.goldBright, fontSize: 13, lineHeight: 20 },
  banner: { backgroundColor: BrandColors.surfaceRaised, borderRadius: Radii.md, padding: Space.lg,
    gap: Space.md, borderWidth: 1, borderColor: BrandColors.border },
  bannerText: { color: BrandColors.textMuted, fontSize: 14, lineHeight: 20 },
  section: { gap: Space.sm },
  sectionHeading: { color: BrandColors.text, fontSize: 17, fontWeight: '700' },
  email: { color: BrandColors.text, fontSize: 16, fontWeight: '700' },
  accountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Space.md, paddingVertical: Space.xs },
  accountLabel: { color: BrandColors.textMuted, fontSize: 14, flex: 1 },
  accountValue: { color: BrandColors.text, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  accountLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.lg, paddingTop: Space.sm },
});
