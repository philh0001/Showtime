import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileSettings } from '@/components/profile-settings';

import { loadHomeData, type HomeData } from '@/services/home-data';
import { loadMovieProgress } from '@/services/movie-progress';
import { loadRecentlyViewed } from '@/services/recently-viewed';
import { loadTvProgress } from '@/services/tv-progress';
import { loadTvSchedules } from '@/services/tv-schedule';
import { getViewingStats } from '@/services/viewing-summary';
import { loadWatchlist } from '@/services/watchlist';
import { getProfileColumns } from '@/services/collection-layout-rules';
import { Layout } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function ProfileScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const { width } = useWindowDimensions();
  const wideStats = getProfileColumns(width) === 2;
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    const next = await loadHomeData({ loadRecentlyViewed, loadWatchlist, loadMovieProgress, loadTvProgress, loadTvSchedules });
    if (current !== request.current) return;
    setData(next);
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => {
    void refresh();
    return () => { request.current += 1; };
  }, [refresh]));
  const stats = data ? getViewingStats(data.watchlist, data.movieProgress, data.tvProgress) : null;
  const hasError = stats && Object.values(stats).some((value) => value === null);
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Your viewing activity</Text>
        {loading ? <ActivityIndicator style={styles.loading} color={colors.accent} accessibilityLabel="Loading viewing statistics" />
          : stats && <View style={[styles.stats, wideStats && styles.statsWide]}>
            <Stat label="Titles in Watchlist" value={stats.watchlist} wide={wideStats} />
            <Stat label="Movies watched" value={stats.moviesWatched} wide={wideStats} />
            <Stat label="TV seasons watched" value={stats.seasonsWatched} wide={wideStats} />
            <Stat label="Shows with viewing progress" value={stats.showsTracked} wide={wideStats} />
            <Stat label="Individually tracked episodes watched" value={stats.episodesWatched} wide={wideStats} />
          </View>}
        {!loading && hasError && <View style={styles.errorGroup}>
          <Text accessibilityRole="alert" style={styles.error}>Some viewing statistics could not be loaded.</Text>
          <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retry}>
            <Text style={styles.link}>Try again</Text>
          </Pressable>
        </View>}
        <View style={styles.group}>
          <Text accessibilityRole="header" style={styles.heading}>Library</Text>
          <Link href="/watchlist" style={styles.navigation}>Watchlist</Link>
          <Link href="/history" style={styles.navigation}>Viewing history</Link>
        </View>
        <ProfileSettings />
        <View style={styles.about}>
          <Text accessibilityRole="header" style={styles.heading}>About Showtime</Text>
          <Text style={styles.subtitle}>Version {Constants.expoConfig?.version ?? '1.0.0'}</Text>
          <Text style={styles.subtitle}>Viewing data is saved on this device.</Text>
          <Link href="https://www.themoviedb.org" accessibilityLabel="Visit TMDB">
            <Image source={require('@/assets/images/tmdb-logo.svg')} style={styles.tmdb} contentFit="contain" accessibilityLabel="TMDB" />
          </Link>
          <Text style={styles.credit}>This product uses the TMDB API but is not endorsed or certified by TMDB.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, wide }: { label: string; value: number | null; wide: boolean }) {
  const styles = createStyles(useTheme());
  return <View style={[styles.stat, wide && styles.statWide]} accessible accessibilityLabel={`${label}: ${value ?? 'Unavailable'}`}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value ?? '?'}</Text>
  </View>;
}

function createStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: Layout.readingMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
  loading: { marginVertical: 40 },
  stats: { marginTop: 12, gap: 10 },
  statsWide: { flexDirection: 'row', flexWrap: 'wrap' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 14, borderRadius: 12, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  statWide: { flexBasis: '48%', flexGrow: 1 },
  statLabel: { flex: 1, color: colors.text, fontSize: 16, lineHeight: 23 },
  statValue: { color: colors.accent, fontSize: 24, fontWeight: '700', minWidth: 44, textAlign: 'right' },
  group: { marginTop: 20, padding: 16, borderRadius: 12, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 2 },
  navigation: { color: colors.accent, fontSize: 16, fontWeight: '700', paddingVertical: 12 },
  about: { marginTop: 20, padding: 16, borderRadius: 12, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 10 },
  heading: { color: colors.text, fontSize: 22, fontWeight: '700' },
  tmdb: { width: 100, height: 24, marginTop: 4 },
  credit: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  errorGroup: { marginTop: 20, alignItems: 'flex-start' },
  error: { color: colors.danger, fontSize: 14 },
  retry: { paddingVertical: 14 },
  link: { color: colors.accent, fontSize: 15, fontWeight: '700' },
});
}
