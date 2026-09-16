import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HomePosterCard } from '@/components/home-poster-card';
import { loadDiscovery } from '@/services/discovery';
import type { DiscoveryResult } from '@/services/discovery-cache';
import { loadSettings } from '@/services/settings';

type DiscoveryFilter = 'all' | 'Movie' | 'TV';

export function DiscoverySection({ destination = false }: { destination?: boolean }) {
  const [data, setData] = useState<DiscoveryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [filter, setFilter] = useState<DiscoveryFilter>('all');
  const request = useRef(0);
  const refresh = useCallback(async (force = false) => {
    const current = ++request.current;
    setLoading(true);
    setError(false);
    try {
      const settings = await loadSettings();
      if (current !== request.current) return;
      if (!destination && (settings.status === 'unavailable' || !settings.showTrending)) {
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
  }, [destination]);
  useFocusEffect(useCallback(() => {
    void refresh();
    return () => { request.current += 1; };
  }, [refresh]));

  if (!enabled) return null;

  return <View style={styles.container}>
    {destination && <View style={styles.intro}>
      <Text style={styles.pageTitle}>Discover</Text>
      <Text style={styles.secondary}>Find something new to watch from this week’s most popular movies and TV shows.</Text>
    </View>}
    {!destination && <View style={styles.sectionHeader}>
      <View style={styles.headerCopy}>
        <Text accessibilityRole="header" style={styles.title}>Discover something new</Text>
        <Text style={styles.secondary}>Trending this week</Text>
      </View>
      <Link href="/discover" accessibilityRole="link" style={styles.seeAll}>See all</Link>
    </View>}
    {destination && <FilterControls selected={filter} onChange={setFilter} />}
    {data && ([['Trending Movies', data.movies, 'Movie'], ['Trending TV', data.tv, 'TV']] as const)
      .filter(([, , mediaType]) => filter === 'all' || filter === mediaType)
      .map(([title, items]) => (
      <View key={title} style={styles.section}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {items.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {items.map((item) => <HomePosterCard key={item.id} item={item} />)}
        </ScrollView> : <Text style={styles.secondary}>No trending titles available.</Text>}
      </View>
    ))}
    {loading && !data && <ActivityIndicator color="#FFFFFF" accessibilityLabel="Loading trending titles" />}
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

function FilterControls({ selected, onChange }: {
  selected: DiscoveryFilter;
  onChange: (value: DiscoveryFilter) => void;
}) {
  return <View style={styles.filters} accessibilityRole="tablist">
    {([['all', 'All'], ['Movie', 'Movies'], ['TV', 'TV shows']] as const).map(([value, label]) => (
      <Pressable
        key={value}
        accessibilityRole="tab"
        accessibilityState={{ selected: selected === value }}
        aria-selected={selected === value}
        onPress={() => onChange(value)}
        style={[styles.filter, selected === value && styles.filterSelected]}
      >
        <Text style={[styles.filterText, selected === value && styles.filterTextSelected]}>{label}</Text>
      </Pressable>
    ))}
  </View>;
}

const styles = StyleSheet.create({
  container: { marginTop: 20, gap: 24 },
  intro: { gap: 8 },
  pageTitle: { color: '#FFFFFF', fontSize: 30, fontWeight: '800' },
  headerCopy: { gap: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { gap: 10 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  seeAll: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', paddingVertical: 8 },
  rail: { gap: 14, paddingRight: 24 },
  filters: { flexDirection: 'row', gap: 8 },
  filter: { borderColor: '#45454E', borderRadius: 999, borderWidth: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  filterSelected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  filterText: { color: '#C7C7CF', fontSize: 14, fontWeight: '700' },
  filterTextSelected: { color: '#0B0B0F' },
  secondary: { color: '#A7A7B0', fontSize: 14, lineHeight: 21 },
  errorGroup: { alignItems: 'flex-start', gap: 4 },
  retry: { paddingVertical: 12, paddingRight: 16 },
  retryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
