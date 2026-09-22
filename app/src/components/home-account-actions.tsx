import { Link } from 'expo-router';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { BrandColors, ControlSize, Radii, Space } from '@/constants/design';
import { useAuth } from '@/hooks/use-auth';

export function HomeAccountActions() {
  const { width } = useWindowDimensions();
  const { status } = useAuth();

  if (Platform.OS !== 'web' || width < 900 || status === 'loading') return null;

  if (status === 'signedIn') {
    return (
      <View style={styles.container}>
        <Link href="/account" style={styles.accountLink}>Your account</Link>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.caption}>Keep your Watchlist across devices</Text>
      <View style={styles.actions}>
        <Link href={{ pathname: '/account', params: { mode: 'sign-in' } }} style={styles.signIn}>Sign in</Link>
        <Link href={{ pathname: '/account', params: { mode: 'sign-up' } }} style={styles.createAccount}>Create account</Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'flex-end', flexShrink: 0, gap: Space.sm },
  caption: { color: BrandColors.textMuted, fontSize: 13, textAlign: 'right' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  signIn: { color: BrandColors.text, fontSize: 15, fontWeight: '700', paddingHorizontal: Space.md, paddingVertical: Space.md },
  createAccount: {
    backgroundColor: BrandColors.goldBright,
    borderRadius: Radii.pill,
    color: BrandColors.onGold,
    fontSize: 15,
    fontWeight: '800',
    minHeight: ControlSize.minimum,
    overflow: 'hidden',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    textAlign: 'center',
  },
  accountLink: {
    borderColor: BrandColors.border,
    borderRadius: Radii.pill,
    borderWidth: 1,
    color: BrandColors.text,
    fontSize: 15,
    fontWeight: '700',
    minHeight: ControlSize.minimum,
    overflow: 'hidden',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    textAlign: 'center',
  },
});
