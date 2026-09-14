import { Image } from 'expo-image';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MovieProgressLoadResult } from '@/services/movie-progress-rules';
import { loadMovieProgress } from '@/services/movie-progress';
import type { ProgressLoadResult } from '@/services/tv-progress-rules';
import { loadTvProgress } from '@/services/tv-progress';
import {
  filterWatchlistItems,
  getWatchlistProgressLabel,
  getWatchlistStatus,
  loadWatchlistProgressData,
  type WatchlistFilter,
  type WatchlistStatus,
} from '@/services/watchlist-progress';
import type { WatchlistItem } from '@/services/watchlist-rules';
import { loadWatchlist, removeFromWatchlist } from '@/services/watchlist';
import { getWatchlistColumns } from '@/services/collection-layout-rules';
import { Layout } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function WatchlistScreen() {
  const styles = createStyles(useTheme());
  const { width } = useWindowDimensions();
  const columns = getWatchlistColumns(width);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [tvProgress, setTvProgress] = useState<ProgressLoadResult>({ status: 'available', records: [] });
  const [movieProgress, setMovieProgress] = useState<MovieProgressLoadResult>({ status: 'available', records: [] });
  const [filter, setFilter] = useState<WatchlistFilter>('all');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadWatchlistProgressData({
        loadWatchlist,
        loadTvProgress,
        loadMovieProgress,
      });
      setItems(data.items);
      setTvProgress(data.tvProgress);
      setMovieProgress(data.movieProgress);
    } catch {
      setError('Could not load your watchlist. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const visibleItems = filterWatchlistItems(items, filter, tvProgress, movieProgress);
  const statusUnavailable = tvProgress.status === 'unavailable'
    || movieProgress.status === 'unavailable';

  async function remove(item: WatchlistItem) {
    const key = itemKey(item);
    if (removing) return;
    setRemoving(key);
    setError(null);
    try {
      setItems(await removeFromWatchlist(item.id, item.mediaType));
    } catch {
      setError('Could not remove that title. Please try again.');
    } finally {
      setRemoving(null);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        key={`watchlist-${columns}`}
        data={visibleItems}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
        keyExtractor={itemKey}
        contentContainerStyle={[styles.content, !loading && visibleItems.length === 0 && styles.emptyContent]}
        ListHeaderComponent={<View style={styles.header}>
          <Text style={styles.title}>Watchlist</Text>
          <Text style={styles.subtitle}>Movies and TV shows you want to watch.</Text>
          {items.length > 0 && <FilterControls selected={filter} onChange={setFilter} />}
          {statusUnavailable && <Text accessibilityRole="alert" style={styles.error}>
            Some watched statuses could not be loaded. Use All to see every saved title.
          </Text>}
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        </View>}
        ListEmptyComponent={loading
          ? <View style={styles.message}>
            <ActivityIndicator color="#FFFFFF" accessibilityLabel="Loading watchlist" />
            <Text style={styles.subtitle}>Loading your watchlist…</Text>
          </View>
          : items.length === 0
            ? <View style={styles.message}>
              <Text style={styles.emptyTitle}>Your watchlist is empty</Text>
              <Text style={styles.subtitle}>Open a movie or TV show from Search and add it here.</Text>
              {error && <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retry}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>}
            </View>
            : <View style={styles.message}>
              <Text style={styles.emptyTitle}>
                {filter === 'watched' ? 'No watched titles' : 'No titles to watch'}
              </Text>
              <Text style={styles.subtitle}>
                No titles in your Watchlist match this filter.
              </Text>
            </View>}
        renderItem={({ item }) => (
          <WatchlistRow
            item={item}
            progressLabel={getWatchlistProgressLabel(item, tvProgress)}
            status={getWatchlistStatus(item, tvProgress, movieProgress)}
            removing={removing === itemKey(item)}
            grid={columns > 1}
            onRemove={() => void remove(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const FILTERS: { label: string; value: WatchlistFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'To Watch', value: 'to-watch' },
  { label: 'Watched', value: 'watched' },
];

function FilterControls({
  selected,
  onChange,
}: {
  selected: WatchlistFilter;
  onChange: (filter: WatchlistFilter) => void;
}) {
  const styles = createStyles(useTheme());
  return (
    <View style={styles.filters}>
      {FILTERS.map((filter) => (
        <Pressable
          key={filter.value}
          accessibilityRole="button"
          accessibilityState={{ selected: selected === filter.value }}
          onPress={() => onChange(filter.value)}
          style={({ pressed }) => [
            styles.filterButton,
            selected === filter.value && styles.filterButtonSelected,
            pressed && styles.dimmed,
          ]}
        >
          <Text style={[
            styles.filterText,
            selected === filter.value && styles.filterTextSelected,
          ]}>{filter.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function WatchlistRow({
  item,
  progressLabel,
  status,
  removing,
  grid,
  onRemove,
}: {
  item: WatchlistItem;
  progressLabel: string | null;
  status: WatchlistStatus;
  removing: boolean;
  grid: boolean;
  onRemove: () => void;
}) {
  const styles = createStyles(useTheme());
  return (
    <View style={[styles.row, grid && styles.gridCard]}>
      <Link
        href={{
          pathname: item.mediaType === 'Movie' ? '/movie/[id]' : '/tv/[id]',
          params: { id: String(item.id) },
        }}
        asChild
      >
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`View ${item.title}, ${item.mediaType}${status === 'watched'
            ? `, ${item.mediaType === 'Movie' ? 'watched' : 'completed'}` : ''}`}
          style={Platform.OS === 'web'
            ? [styles.detailsLink, grid && styles.detailsLinkGrid]
            : ({ pressed }) => [styles.detailsLink, grid && styles.detailsLinkGrid, pressed && styles.dimmed]}
        >
          <Artwork item={item} status={status} grid={grid} />
          <View style={styles.rowText}>
            <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.year ?? 'Year unknown'} · {item.mediaType}</Text>
            {progressLabel && <Text style={styles.progress}>{progressLabel}</Text>}
          </View>
        </Pressable>
      </Link>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.title} from Watchlist`}
        accessibilityState={{ disabled: removing, busy: removing }}
        disabled={removing}
        onPress={onRemove}
        style={({ pressed }) => [styles.removeButton, pressed && styles.dimmed]}
      >
        <Text style={styles.removeText}>{removing ? 'Removing…' : 'Remove'}</Text>
      </Pressable>
    </View>
  );
}

function Artwork({ item, status, grid }: { item: WatchlistItem; status: WatchlistStatus; grid: boolean }) {
  const [failed, setFailed] = useState(false);
  const styles = createStyles(useTheme());
  const statusLabel = item.mediaType === 'Movie' ? 'Watched' : 'Completed';
  return (
    <View style={[styles.poster, grid && styles.posterGrid]}>
      <View style={[styles.posterContent, status === 'watched' && styles.watchedPoster]}>
        {item.posterUrl && !failed
          ? <Image
            source={{ uri: item.posterUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            accessibilityLabel={`${item.title} poster`}
            onError={() => setFailed(true)}
          />
          : <Text style={styles.posterFallback}>No poster</Text>}
      </View>
      {status === 'watched' && <View style={styles.statusBadge}>
        <Text style={styles.statusBadgeText}>{statusLabel}</Text>
      </View>}
    </View>
  );
}

function itemKey(item: WatchlistItem) {
  return `${item.mediaType}-${item.id}`;
}

function createStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: Layout.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  emptyContent: { flexGrow: 1 },
  header: { marginBottom: 24 },
  title: { color: colors.text, fontSize: 32, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
  filters: { flexDirection: 'row', gap: 8, marginTop: 18 },
  filterButton: { minHeight: 44, justifyContent: 'center', borderColor: colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  filterButtonSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  filterTextSelected: { color: colors.onAccent },
  error: { color: colors.danger, fontSize: 14, marginTop: 12 },
  message: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 24 },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  retry: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  retryText: { color: colors.onAccent, fontSize: 15, fontWeight: '700' },
  row: { gap: 12 },
  gridRow: { gap: 16 },
  gridCard: { flex: 1, minWidth: 0, padding: 12, borderRadius: 12, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
  detailsLink: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  detailsLinkGrid: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
  poster: { width: 72, height: 108, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  posterGrid: { width: '100%', height: undefined, aspectRatio: 2 / 3 },
  posterContent: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  watchedPoster: { opacity: 0.55 },
  posterFallback: { color: colors.textSecondary, fontSize: 12, textAlign: 'center' },
  statusBadge: { position: 'absolute', left: 5, right: 5, bottom: 6, borderRadius: 5, backgroundColor: colors.accent, paddingHorizontal: 4, paddingVertical: 3 },
  statusBadgeText: { color: colors.onAccent, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  rowText: { flex: 1, gap: 6 },
  itemTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  progress: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  removeButton: { alignSelf: 'flex-end', paddingHorizontal: 4, paddingVertical: 8 },
  removeText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 18 },
  dimmed: { opacity: 0.65 },
});
}
