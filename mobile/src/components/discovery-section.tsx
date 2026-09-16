import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HomePosterCard } from '@/components/home-poster-card';
import { loadDiscovery } from '@/services/discovery';
import type { DiscoveryResult } from '@/services/discovery-cache';
import { loadSettings } from '@/services/settings';
import { useTheme } from '@/hooks/use-theme';

export function DiscoverySection() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const [data, setData] = useState<DiscoveryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const request = useRef(0);
  const refresh = useCallback(async (force = false) => {
    const current = ++request.current;
    setLoading(true);
    setError(false);
    try {
      const settings = await loadSettings();
      if (current !== request.current) return;
      if (settings.status === 'unavailable' || !settings.showTrending) {
        setEnabled(false);
        return;
      }
      setEnabled(true);
      const next = await loadDiscovery(force);
      if (current === request.current) setData(next);
    } catch {
      if (current === request.current) setError(true);
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => {
    void refresh();
    return () => { request.current += 1; };
  }, [refresh]));

  if (!enabled) return null;

  return <View style={styles.container}>
    {data && ([['Trending Movies', data.movies], ['Trending TV', data.tv]] as const).map(([title, items]) => (
      <View key={title} style={styles.section}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {items.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {items.map((item) => <HomePosterCard key={item.id} item={item} />)}
        </ScrollView> : <Text style={styles.secondary}>No trending titles available.</Text>}
      </View>
    ))}
    {loading && !data && <ActivityIndicator color={colors.accent} accessibilityLabel="Loading trending titles" />}
    {!loading && (error || data?.stale) && <View style={styles.errorGroup}>
      <Text style={styles.secondary} accessibilityRole="alert">
        {data ? 'Trending titles could not be refreshed.' : 'Trending titles are unavailable.'}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry trending titles" onPress={() => void refresh(true)} style={styles.retry}>
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>}
  </View>;
}

function createStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
  container: { marginTop: 20, gap: 24 },
  section: { gap: 10 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  rail: { gap: 14, paddingRight: 24 },
  secondary: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
  errorGroup: { alignItems: 'flex-start', gap: 4 },
  retry: { paddingVertical: 12, paddingRight: 16 },
  retryText: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
}
