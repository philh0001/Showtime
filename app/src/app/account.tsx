import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/use-auth';
import { requestPasswordReset, resetPassword } from '@/services/auth';

type Mode = 'sign-in' | 'sign-up' | 'forgot' | 'reset';

export default function AccountScreen() {
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
    setNotice('If that email has an account, a reset link was requested.');
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
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Signed in</Text>
          <Text style={styles.subtitle}>{user.email}</Text>
          {!user.emailVerified && (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>Verify your email to sync across devices. Select the link in the email we sent, then refresh your account status.</Text>
              <PrimaryButton label={busy ? 'Refreshing…' : 'Refresh account status'} onPress={() => void refresh()} disabled={busy} />
            </View>
          )}
          {user.emailVerified && (
            <View style={styles.section}>
              <PrimaryButton label={syncing ? 'Syncing…' : 'Sync now'} onPress={() => void syncNow()} disabled={syncing} />
              {lastSyncError && <Text style={styles.error}>{lastSyncError}</Text>}
            </View>
          )}
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          {notice && <Text style={styles.notice}>{notice}</Text>}
          <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Sign out</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>
          {mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : mode === 'forgot' ? 'Reset password' : 'New password'}
        </Text>
        <Text style={styles.subtitle}>
          An account lets your Watchlist, progress and viewing history follow you across devices.
        </Text>

        {(mode === 'sign-in' || mode === 'sign-up' || mode === 'forgot') && (
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#7A7A82"
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
            placeholderTextColor="#7A7A82"
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
              placeholderTextColor="#7A7A82"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password"
              placeholderTextColor="#7A7A82"
              secureTextEntry
              autoCapitalize="none"
              style={styles.input}
            />
          </>
        )}

        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {notice && <Text style={styles.notice}>{notice}</Text>}
        {devToken && <Text style={styles.devToken}>Dev reset token (temporary, until real email delivery is wired up): {devToken}</Text>}

        {mode === 'sign-in' && <PrimaryButton label={busy ? 'Signing in…' : 'Sign in'} onPress={() => void submitSignIn()} disabled={busy || !email.trim() || !password} />}
        {mode === 'sign-up' && <PrimaryButton label={busy ? 'Creating account…' : 'Create account'} onPress={() => void submitSignUp()} disabled={busy || !email.trim() || !password} />}
        {mode === 'forgot' && <PrimaryButton label={busy ? 'Requesting…' : 'Send reset link'} onPress={() => void submitForgot()} disabled={busy || !email.trim()} />}
        {mode === 'reset' && <PrimaryButton label={busy ? 'Resetting…' : 'Reset password'} onPress={() => void submitReset()} disabled={busy || !resetToken.trim() || !newPassword} />}

        <View style={styles.links}>
          {mode !== 'sign-in' && <Pressable onPress={() => { setMode('sign-in'); setError(null); setNotice(null); }}><Text style={styles.link}>Sign in</Text></Pressable>}
          {mode !== 'sign-up' && <Pressable onPress={() => { setMode('sign-up'); setError(null); setNotice(null); }}><Text style={styles.link}>Create an account</Text></Pressable>}
          {mode !== 'forgot' && mode !== 'reset' && <Pressable onPress={() => { setMode('forgot'); setError(null); setNotice(null); }}><Text style={styles.link}>Forgot password?</Text></Pressable>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={[styles.primaryButton, disabled && styles.primaryDisabled]}>
      {disabled && label.endsWith('…') ? <ActivityIndicator color="#0B0B0F" /> : <Text style={styles.primaryText}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0F' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, gap: 14 },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
  subtitle: { color: '#A7A7B0', fontSize: 15, lineHeight: 22 },
  input: {
    backgroundColor: '#191C22',
    borderWidth: 1,
    borderColor: '#2B3038',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 16,
  },
  primaryButton: { backgroundColor: '#63D7BA', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryDisabled: { opacity: 0.6 },
  primaryText: { color: '#0B0B0F', fontSize: 16, fontWeight: '700' },
  secondaryButton: { paddingVertical: 14, alignItems: 'center' },
  secondaryText: { color: '#FF8A8A', fontSize: 15, fontWeight: '700' },
  links: { gap: 10, marginTop: 4 },
  link: { color: '#63D7BA', fontSize: 15, fontWeight: '700' },
  error: { color: '#FF8A8A', fontSize: 14 },
  notice: { color: '#63D7BA', fontSize: 14 },
  devToken: { color: '#D7A84A', fontSize: 12 },
  banner: { backgroundColor: '#191C22', borderRadius: 12, padding: 14, gap: 10, borderWidth: 1, borderColor: '#2B3038' },
  bannerText: { color: '#DDDEE3', fontSize: 14, lineHeight: 20 },
  section: { gap: 10 },
});
