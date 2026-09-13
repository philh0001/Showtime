import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { loadSettings, setShowTrending } from '@/services/settings';
import type { SettingsResult } from '@/services/settings-storage';

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
    return () => { request.current += 1; };
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
    <View style={styles.row}>
      <Text style={styles.label}>Trending on Home</Text>
      <Switch accessibilityLabel="Trending on Home" value={settings?.status === 'available' && settings.showTrending}
        disabled={settings?.status !== 'available' || saving} onValueChange={(value) => void toggle(value)}
        trackColor={{ false: '#38383F', true: '#23886F' }} thumbColor="#FFFFFF" />
    </View>
    {settings?.status === 'unavailable' && <View>
      <Text accessibilityRole="alert" style={styles.error}>Settings could not be loaded.</Text>
      <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retry}><Text style={styles.label}>Try again</Text></Pressable>
    </View>}
    {error && <Text accessibilityRole="alert" style={styles.error}>Your change could not be saved. Please try again.</Text>}
  </View>;
}

const styles = StyleSheet.create({
  section: { marginTop: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#29292F', gap: 10 },
  heading: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 8 },
  label: { color: '#DDDEE3', fontSize: 16, flexShrink: 1 },
  error: { color: '#FF8A8A', fontSize: 14, lineHeight: 21 },
  retry: { paddingVertical: 14, alignSelf: 'flex-start' },
});
