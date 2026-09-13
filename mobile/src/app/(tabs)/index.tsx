import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomePosterCard, type HomePosterItem } from '@/components/home-poster-card';
import { DiscoverySection } from '@/components/discovery-section';
import { UpcomingSection } from '@/components/upcoming-section';
import { loadHomeData, type HomeData } from '@/services/home-data';
import { findWatchedMovie, type WatchedMovie } from '@/services/movie-progress-rules';
import { loadMovieProgress } from '@/services/movie-progress';
import { loadRecentlyViewed } from '@/services/recently-viewed';
import { loadWatchlist } from '@/services/watchlist';
import { loadTvProgress } from '@/services/tv-progress';
import { loadTvSchedules } from '@/services/tv-schedule';
import { getContinueWatching, type ViewingProgress } from '@/services/viewing-summary';

export default function HomeScreen() {
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

  const recentItems = data?.recentlyViewed.status === 'available'
    ? data.recentlyViewed.items : [];
  const watchlistItems = data?.watchlist.status === 'available'
    ? data.watchlist.items : [];
  const watchedMovies = data?.movieProgress.status === 'available'
    ? data.movieProgress.records : [];
  const continueWatching = data ? getContinueWatching(watchlistItems, recentItems, data.tvProgress,
    data.tvSchedules.status === 'available' ? data.tvSchedules.records : []) : [];
  const hasError = data?.recentlyViewed.status === 'unavailable'
    || data?.watchlist.status === 'unavailable'
    || data?.movieProgress.status === 'unavailable'
    || data?.tvProgress.status === 'unavailable';
  const showFirstUse = data?.recentlyViewed.status === 'available'
    && data.watchlist.status === 'available'
    && data.movieProgress.status === 'available'
    && data.tvProgress.status === 'available'
    && data.tvProgress.records.length === 0
    && recentItems.length === 0
    && watchlistItems.length === 0
    && watchedMovies.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.logo}>SHOWTIME</Text>
        <Link href="/search" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Search movies and TV"
            style={Platform.OS === 'web' ? styles.searchButton : ({ pressed }) => [styles.searchButton, pressed && styles.pressed]}
          >
            <Text style={styles.searchButtonText}>Search movies and TV</Text>
          </Pressable>
        </Link>

        {loading && <View style={styles.message}>
          <ActivityIndicator color="#FFFFFF" accessibilityLabel="Loading Home" />
          <Text style={styles.secondary}>Loading your Home screen…</Text>
        </View>}

        {!loading && continueWatching.length > 0
          && <PosterRail title="Continue Watching" items={continueWatching.slice(0, 20)}
            getProgress={(item) => continueWatching.find((show) => show.id === item.id)?.progress} />}

        {!loading && recentItems.length > 0
          && <PosterRail title="Recently Viewed" items={recentItems} />}

        {!loading && data && <UpcomingSection watchlist={watchlistItems} progress={data.tvProgress}
          cache={data.tvSchedules} onRetry={refresh} />}

        {!loading && watchedMovies.length > 0
          && <PosterRail
            title="Watched Movies"
            items={watchedMovies.slice(0, 20).map(watchedMovieToPosterItem)}
            statusLabel="Watched"
            action={<Link href="/history" style={styles.seeAll}>History</Link>}
          />}

        {!loading && watchlistItems.length > 0
          && <PosterRail
            title="Watchlist"
            items={watchlistItems.slice(0, 10)}
            getStatusLabel={(item) => item.mediaType === 'Movie'
              && findWatchedMovie(watchedMovies, item.id) ? 'Watched' : undefined}
            action={<Link href="/watchlist" style={styles.seeAll}>See all</Link>}
          />}

        {!loading && showFirstUse && <View style={styles.firstUse}>
          <Text style={styles.emptyTitle}>Your Home screen is ready</Text>
          <Text style={styles.secondary}>
            Search for a movie or TV show. Titles you open and save will appear here.
          </Text>
        </View>}

        {!loading && hasError && <View style={styles.errorCard}>
          <Text accessibilityRole="alert" style={styles.error}>
            Some saved Home content could not be loaded.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void refresh()}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
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
      {items.length === 1 ? <HomePosterCard item={items[0]} compact
        statusLabel={statusLabel ?? getStatusLabel?.(items[0])} progress={getProgress?.(items[0])} /> : <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {items.map((item) => (
          <HomePosterCard
            key={`${item.mediaType}:${item.id}`}
            item={item}
            statusLabel={statusLabel ?? getStatusLabel?.(item)}
            progress={getProgress?.(item)}
          />
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
  container: { flex: 1, backgroundColor: '#0B0B0F' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  logo: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', letterSpacing: 0 },
  searchButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  searchButtonText: { color: '#0B0B0F', fontSize: 15, fontWeight: '700' },
  message: { minHeight: 180, gap: 14, alignItems: 'center', justifyContent: 'center' },
  secondary: { color: '#A7A7B0', fontSize: 15, lineHeight: 22 },
  section: { marginTop: 20, gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  seeAll: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', paddingVertical: 8 },
  rail: { gap: 14, paddingRight: 24 },
  firstUse: { gap: 6, marginTop: 20, paddingVertical: 8 },
  emptyTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '700' },
  errorCard: { alignItems: 'flex-start', gap: 12, marginTop: 28 },
  error: { color: '#FF8A8A', fontSize: 14 },
  retryButton: { borderColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.65 },
});
