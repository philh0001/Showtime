import { Image } from 'expo-image';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatUkDate, getCountdownLabel, getDeviceLocalIsoDate } from '@/services/air-date-rules';
import { formatLocalUkWatchedDate } from '@/services/movie-progress-rules';
import { getUpcomingEpisodes, type ScheduleLoadResult } from '@/services/tv-schedule-rules';
import type { ProgressLoadResult } from '@/services/tv-progress-rules';
import type { WatchlistItem } from '@/services/watchlist-rules';

export function UpcomingSection({ watchlist, progress, cache, onRetry }: {
  watchlist: WatchlistItem[]; progress: ProgressLoadResult; cache: ScheduleLoadResult; onRetry: () => Promise<void>;
}) {
  const [today, setToday] = useState(getDeviceLocalIsoDate);
  useFocusEffect(useCallback(() => {
    setToday(getDeviceLocalIsoDate());
    const timer = setInterval(() => setToday(getDeviceLocalIsoDate()), 60000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(getDeviceLocalIsoDate());
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []));
  const items = cache?.status === 'available' ? getUpcomingEpisodes(cache.records, watchlist, progress, today) : [];
  const hasShows = watchlist.some((item) => item.mediaType === 'TV') || (progress.status === 'available' && progress.records.length > 0);
  if (!hasShows && cache?.status !== 'unavailable') return null;
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.heading}>Upcoming Episodes</Text>
    {items.slice(0, 10).map((item) => <Link key={item.id} href={{ pathname: '/tv/[id]', params: { id: String(item.id) } }} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={`Open ${item.title}, season ${item.episode.seasonNumber}, episode ${item.episode.episodeNumber}, ${getCountdownLabel(item.episode.airDate, today)}`}
        style={Platform.OS === 'web' ? styles.row : ({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.poster}>
          {item.posterUrl && <Image source={{ uri: item.posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={`${item.title} poster`} />}
        </View>
        <View style={styles.details}>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.countdown}>{getCountdownLabel(item.episode.airDate, today)}</Text>
          <Text style={styles.meta}>S{item.episode.seasonNumber} E{item.episode.episodeNumber} · {formatUkDate(item.episode.airDate)}</Text>
          {item.episode.name && <Text style={styles.meta} numberOfLines={2}>{item.episode.name}</Text>}
          <Text style={styles.checked}>Checked {formatLocalUkWatchedDate(item.checkedAt)}</Text>
        </View>
      </Pressable>
    </Link>)}
    {cache?.status === 'available' && items.length === 0 && <Text style={styles.meta}>No upcoming episodes in your saved schedules.</Text>}
    {cache?.status === 'unavailable' && <View>
      <Text accessibilityRole="alert" style={styles.meta}>Saved schedules could not be loaded.</Text>
      <Pressable accessibilityRole="button" onPress={() => void onRetry()} style={styles.retry}><Text style={styles.title}>Try again</Text></Pressable>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  section: { marginTop: 32, gap: 14 },
  heading: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#29292F' },
  poster: { width: 64, height: 96, borderRadius: 8, backgroundColor: '#212225', overflow: 'hidden' },
  details: { flex: 1, gap: 4 },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', lineHeight: 22 },
  countdown: { color: '#63D7BA', fontSize: 14, fontWeight: '700' },
  meta: { color: '#A7A7B0', fontSize: 13, lineHeight: 20 },
  checked: { color: '#A7A7B0', fontSize: 11, lineHeight: 18 },
  retry: { paddingVertical: 14, alignSelf: 'flex-start' },
  pressed: { opacity: 0.65 },
});
