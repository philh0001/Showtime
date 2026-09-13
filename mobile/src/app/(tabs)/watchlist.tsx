import { Image } from 'expo-image';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ProgressLoadResult } from '@/services/tv-progress-rules';
import { loadTvProgress } from '@/services/tv-progress';
import { getWatchlistProgressLabel, loadWatchlistProgressData } from '@/services/watchlist-progress';
import type { WatchlistItem } from '@/services/watchlist-rules';
import { loadWatchlist, removeFromWatchlist } from '@/services/watchlist';

export default function WatchlistScreen() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressLoadResult>({ status: 'available', records: [] });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadWatchlistProgressData({ loadWatchlist, loadProgress: loadTvProgress });
      setItems(data.items);
      setProgress(data.progress);
    } catch {
      setError('Could not load your watchlist. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

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
        data={items}
        keyExtractor={itemKey}
        contentContainerStyle={[styles.content, !loading && items.length === 0 && styles.emptyContent]}
        ListHeaderComponent={<View style={styles.header}>
          <Text style={styles.title}>Watchlist</Text>
          <Text style={styles.subtitle}>Movies and TV shows you want to watch.</Text>
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        </View>}
        ListEmptyComponent={loading
          ? <View style={styles.message}>
            <ActivityIndicator color="#FFFFFF" accessibilityLabel="Loading watchlist" />
            <Text style={styles.subtitle}>Loading your watchlist…</Text>
          </View>
          : <View style={styles.message}>
            <Text style={styles.emptyTitle}>Your watchlist is empty</Text>
            <Text style={styles.subtitle}>Open a movie or TV show from Search and add it here.</Text>
            {error && <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retry}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>}
          </View>}
        renderItem={({ item }) => (
          <WatchlistRow
            item={item}
            progressLabel={getWatchlistProgressLabel(item, progress)}
            removing={removing === itemKey(item)}
            onRemove={() => void remove(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

function WatchlistRow({
  item,
  progressLabel,
  removing,
  onRemove,
}: {
  item: WatchlistItem;
  progressLabel: string | null;
  removing: boolean;
  onRemove: () => void;
}) {
  return (
    <View style={styles.row}>
      <Link
        href={{
          pathname: item.mediaType === 'Movie' ? '/movie/[id]' : '/tv/[id]',
          params: { id: String(item.id) },
        }}
        asChild
      >
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`View ${item.title}, ${item.mediaType}`}
          style={({ pressed }) => [styles.detailsLink, pressed && styles.dimmed]}
        >
          <Artwork item={item} />
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

function Artwork({ item }: { item: WatchlistItem }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={styles.poster}>
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
  );
}

function itemKey(item: WatchlistItem) {
  return `${item.mediaType}-${item.id}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0F' },
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  emptyContent: { flexGrow: 1 },
  header: { marginBottom: 24 },
  title: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#A7A7B0', fontSize: 15, lineHeight: 22 },
  error: { color: '#FF8A8A', fontSize: 14, marginTop: 12 },
  message: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 24 },
  emptyTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  retry: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  retryText: { color: '#0B0B0F', fontSize: 15, fontWeight: '700' },
  row: { gap: 12 },
  detailsLink: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  poster: { width: 72, height: 108, borderRadius: 8, overflow: 'hidden', backgroundColor: '#212225', alignItems: 'center', justifyContent: 'center' },
  posterFallback: { color: '#A7A7B0', fontSize: 12, textAlign: 'center' },
  rowText: { flex: 1, gap: 6 },
  itemTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  progress: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  removeButton: { alignSelf: 'flex-end', paddingHorizontal: 4, paddingVertical: 8 },
  removeText: { color: '#FF8A8A', fontSize: 15, fontWeight: '600' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#393940', marginVertical: 18 },
  dimmed: { opacity: 0.65 },
});
