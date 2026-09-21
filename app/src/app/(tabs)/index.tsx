import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SearchPanel } from '@/components/search-panel';
import { ShowtimeLogo } from '@/components/showtime-logo';
import { BrandColors, ControlSize, Layout, Radii, Space } from '@/constants/design';
import { HomePosterCard, type HomePosterItem } from '@/components/home-poster-card';
import { DiscoverySection } from '@/components/discovery-section';
import { UpcomingSection } from '@/components/upcoming-section';
import { loadHomeData, type HomeData } from '@/services/home-data';
import { type WatchedMovie } from '@/services/movie-progress-rules';
import { loadMovieProgress } from '@/services/movie-progress';
import { loadRecentlyViewed } from '@/services/recently-viewed';
import { loadWatchlist } from '@/services/watchlist';
import { loadTvProgress } from '@/services/tv-progress';
import { loadTvSchedules } from '@/services/tv-schedule';
import { useSearchController } from '@/services/search-controller';
import { subscribeLibraryChanges } from '@/services/library-changes';
import { getContinueWatching, type ViewingProgress } from '@/services/viewing-summary';

export default function HomeScreen() {
  const search = useSearchController();
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
    const unsubscribe = subscribeLibraryChanges((origin) => { if (origin === 'remote') void refresh(); });
    return () => { unsubscribe(); request.current += 1; };
  }, [refresh]));

  const recentItems = data?.recentlyViewed.status === 'available' ? data.recentlyViewed.items : [];
  const watchlistItems = data?.watchlist.status === 'available' ? data.watchlist.items : [];
  const watchedMovies = data?.movieProgress.status === 'available' ? data.movieProgress.records : [];
  const continueWatching = data ? getContinueWatching(
    watchlistItems,
    recentItems,
    data.tvProgress,
    data.tvSchedules.status === 'available' ? data.tvSchedules.records : [],
  ) : [];
  const hasError = data?.recentlyViewed.status === 'unavailable'
    || data?.watchlist.status === 'unavailable'
    || data?.movieProgress.status === 'unavailable'
    || data?.tvProgress.status === 'unavailable';
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <ShowtimeLogo decorative />
        </View>

        <SearchPanel
          compact
          query={search.query}
          results={search.results}
          status={search.status}
          message={search.message}
          suggestions={search.suggestions}
          onChangeQuery={search.changeQuery}
          onSubmit={search.submit}
          onClear={search.clear}
          onClearHistory={search.clearHistory}
        />

        {loading && <View style={styles.message}>
          <ActivityIndicator color={BrandColors.gold} accessibilityLabel="Loading Home" />
          <Text style={styles.secondary}>Loading your Home screen…</Text>
        </View>}

        {!loading && data && <UpcomingSection watchlist={watchlistItems} progress={data.tvProgress} cache={data.tvSchedules} onRetry={refresh} />}

        {!loading && continueWatching.length > 0 && <PosterRail title="Continue Watching" items={continueWatching.slice(0, 20)} getProgress={(item) => continueWatching.find((show) => show.id === item.id)?.progress} />}

        {!loading && recentItems.length > 0 && <PosterRail title="Recently Viewed" items={recentItems} />}

        {!loading && watchedMovies.length > 0 && <PosterRail title="Watched Movies" items={watchedMovies.slice(0, 20).map(watchedMovieToPosterItem)} statusLabel="Watched" action={<Link href="/history" style={styles.seeAll}>History</Link>} />}

        {!loading && hasError && <View style={styles.errorCard}>
          <Text accessibilityRole="alert" style={styles.error}>Some saved Home content could not be loaded.</Text>
          <Pressable accessibilityRole="button" onPress={() => void refresh()} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>}

        <DiscoverySection />
      </ScrollView>
    </SafeAreaView>
  );
}

function PosterRail({
  title,
  items,
  action,
  statusLabel,
  getStatusLabel,
  getProgress,
}: {
  title: string;
  items: HomePosterItem[];
  action?: ReactNode;
  statusLabel?: 'Watched' | 'Completed';
  getStatusLabel?: (item: HomePosterItem) => 'Watched' | 'Completed' | undefined;
  getProgress?: (item: HomePosterItem) => ViewingProgress | undefined;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
        {action}
      </View>
      {items.length === 1
        ? <HomePosterCard item={items[0]} compact statusLabel={statusLabel ?? getStatusLabel?.(items[0])} progress={getProgress?.(items[0])} />
        : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {items.map((item) => (
            <HomePosterCard key={`${item.mediaType}:${item.id}`} item={item} statusLabel={statusLabel ?? getStatusLabel?.(item)} progress={getProgress?.(item)} />
          ))}
        </ScrollView>}
    </View>
  );
}

function watchedMovieToPosterItem(movie: WatchedMovie): HomePosterItem {
  return {
    id: movie.movieId,
    mediaType: 'Movie',
    title: movie.title,
    year: movie.year,
    posterUrl: movie.posterUrl,
  };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BrandColors.background },
  content: { paddingHorizontal: Layout.phonePadding, paddingTop: Space.lg, paddingBottom: Space.xxl, gap: Space.lg },
  header: { marginBottom: Space.xs },
  logo: { color: BrandColors.text, fontSize: 30, fontWeight: '800', letterSpacing: 0.5 },
  message: { minHeight: 160, gap: Space.md, alignItems: 'center', justifyContent: 'center' },
  secondary: { color: BrandColors.textMuted, fontSize: 15, lineHeight: 22 },
  section: { gap: Space.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: BrandColors.text, fontSize: 20, fontWeight: '800' },
  seeAll: { color: BrandColors.text, fontSize: 15, fontWeight: '700', paddingVertical: 8 },
  rail: { paddingRight: Space.md },
  errorCard: {
    backgroundColor: BrandColors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: Space.lg,
    gap: Space.md,
  },
  error: { color: BrandColors.text, fontSize: 15, fontWeight: '600' },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: BrandColors.gold,
    borderRadius: Radii.pill,
    minHeight: ControlSize.minimum,
    paddingHorizontal: Space.lg,
    justifyContent: 'center',
  },
  retryText: { color: BrandColors.onGold, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});
