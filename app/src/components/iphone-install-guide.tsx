import { useState } from 'react';
import { Link } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandColors, ControlSize, Radii, Space } from '@/constants/design';
import { useAuth } from '@/hooks/use-auth';
import { getIPhoneInstallGuide, type IPhoneInstallGuide } from '@/services/install-guide-rules';

const DISMISSED_KEY = 'showtime.iphone-install-tip.dismissed.v1';

function currentGuide(): IPhoneInstallGuide {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || typeof window === 'undefined') return null;
  let dismissed = false;
  try { dismissed = window.localStorage.getItem(DISMISSED_KEY) === '1'; } catch { /* Private browsing can block storage. */ }
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return getIPhoneInstallGuide({ userAgent: navigator.userAgent, standalone, dismissed });
}

function InstallSteps() {
  return (
    <View style={styles.steps}>
      <Text style={styles.body}>1. In Safari, tap Share (or Page Menu → Share).</Text>
      <Text style={styles.body}>2. Tap Add to Home Screen.</Text>
      <Text style={styles.body}>3. Turn on Open as Web App, then tap Add.</Text>
    </View>
  );
}

export function IPhoneInstallPrompt() {
  const [guide, setGuide] = useState<IPhoneInstallGuide>(currentGuide);
  const { status, user } = useAuth();
  if (!guide) return null;

  function dismiss() {
    try { window.localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* The visible tip can still close. */ }
    setGuide(null);
  }

  return (
    <View style={styles.prompt}>
      <View style={styles.headingRow}>
        <Text accessibilityRole="header" style={styles.heading}>Put Showtime on your iPhone</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss iPhone install tip" onPress={dismiss} style={styles.dismiss}>
          <Text style={styles.dismissText}>Close</Text>
        </Pressable>
      </View>
      {guide === 'open-safari' && <Text style={styles.body}>Open showtimetracker.show in Safari first.</Text>}
      <InstallSteps />
      <Text style={styles.note}>The Home Screen app has its own saved library. Use a verified account here, then sign in from the icon to bring your titles over.</Text>
      {status === 'signedOut' && <Link href={{ pathname: '/account', params: { mode: 'sign-up' } }} style={styles.accountLink}>Create an account</Link>}
      {status === 'signedIn' && !user?.emailVerified && <Link href="/account" style={styles.accountLink}>Verify your account</Link>}
    </View>
  );
}

export function IPhoneInstallHelp() {
  if (Platform.OS !== 'web') return null;
  return (
    <View style={styles.help}>
      <Text accessibilityRole="header" style={styles.heading}>Add Showtime to your iPhone</Text>
      <Text style={styles.body}>Open showtimetracker.show in Safari:</Text>
      <InstallSteps />
      <Text style={styles.note}>The Home Screen app has separate saved data. Use a verified account in Safari, then sign in again from the icon to restore your library.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: {
    backgroundColor: BrandColors.surface,
    borderColor: BrandColors.border,
    borderRadius: Radii.md,
    borderWidth: 1,
    gap: Space.sm,
    padding: Space.lg,
  },
  help: {
    borderTopColor: BrandColors.border,
    borderTopWidth: 1,
    gap: Space.sm,
    marginTop: Space.lg,
    paddingTop: Space.lg,
  },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.sm },
  heading: { color: BrandColors.text, flex: 1, fontSize: 18, fontWeight: '800' },
  body: { color: BrandColors.textMuted, fontSize: 14, lineHeight: 20 },
  note: { color: BrandColors.textMuted, fontSize: 13, lineHeight: 19 },
  accountLink: { color: BrandColors.goldBright, fontSize: 14, fontWeight: '700', paddingVertical: Space.sm },
  steps: { gap: Space.xs },
  dismiss: { minHeight: ControlSize.minimum, justifyContent: 'center', paddingHorizontal: Space.sm },
  dismissText: { color: BrandColors.goldBright, fontSize: 14, fontWeight: '700' },
});
