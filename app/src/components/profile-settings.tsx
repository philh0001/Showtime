import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { loadSettings, setShowTrending } from '@/services/settings';
import type { SettingsResult } from '@/services/settings-storage';
import { subscribeLibraryChanges } from '@/services/library-changes';
import { BrandColors, ControlSize, Radii, Space } from '@/constants/design';

export function ProfileSettings() {
  const [settings, setSettings] = useState<SettingsResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const busy = useRef(false);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++request.current;
    const next = await loadSettings();
    if (current === request.current) setSettings(next);
  }, []);
  useFocusEffect(useCallback(() => {
    void refresh();
    const unsubscribe = subscribeLibraryChanges((origin) => { if (origin === 'remote') void refresh(); });
    return () => { unsubscribe(); request.current += 1; };
  }, [refresh]));
  async function toggle(value: boolean) {
    if (settings?.status !== 'available' || busy.current) return;
    request.current += 1;
    busy.current = true;
    const previous = settings;
    setSaving(true);
    setError(false);
    setSettings({ status: 'available', showTrending: value });
    try {
      await setShowTrending(value);
      setSettings({ status: 'available', showTrending: value });
    }
    catch { setSettings(previous); setError(true); }
    finally { busy.current = false; setSaving(false); }
  }
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.heading}>Settings</Text>
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>Trending on Home</Text>
        <Switch accessibilityLabel="Trending on Home" value={settings?.status === 'available' && settings.showTrending}
          disabled={settings?.status !== 'available' || saving} onValueChange={(value) => void toggle(value)}
          trackColor={{ false: BrandColors.border, true: BrandColors.gold }} thumbColor={BrandColors.text} />
      </View>
      <Text style={styles.description}>Show popular titles on Home.</Text>
    </View>
    {settings?.status === 'unavailable' && <View>
      <Text accessibilityRole="alert" style={styles.error}>Settings could not be loaded.</Text>
      <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retry}><Text style={styles.label}>Try again</Text></Pressable>
    </View>}
    {error && <Text accessibilityRole="alert" style={styles.error}>Your change could not be saved. Please try again.</Text>}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: Space.sm },
  heading: { color: BrandColors.text, fontSize: 20, fontWeight: '800' },
  card: { backgroundColor: BrandColors.surfaceRaised, borderRadius: Radii.md, borderWidth: 1,
    borderColor: BrandColors.border, paddingHorizontal: Space.lg, paddingVertical: Space.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.md,
    minHeight: ControlSize.minimum },
  label: { color: BrandColors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  description: { color: BrandColors.textMuted, fontSize: 12, lineHeight: 18, paddingBottom: Space.sm },
  error: { color: BrandColors.danger, fontSize: 14, lineHeight: 21 },
  retry: { minHeight: ControlSize.minimum, justifyContent: 'center', alignSelf: 'flex-start' },
});
