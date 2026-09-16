import { Image } from 'expo-image';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadViewingActivity } from '@/services/viewing-activity';
import { describeViewingAction, filterViewingActivity, type ActivityFilter, type ActivityLoadResult, type ViewingActivity } from '@/services/viewing-activity-rules';
import { formatLocalUkWatchedDate } from '@/services/movie-progress-rules';
import { Layout } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function HistoryScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const [data, setData] = useState<ActivityLoadResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    const next = await loadViewingActivity();
    if (current === request.current) { setData(next); setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => {
    void refresh();
    return () => { request.current += 1; };
  }, [refresh]));
  const records = data?.status === 'available' ? filterViewingActivity(data.records, filter) : [];
  return <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
    <View style={styles.filters} accessibilityRole="tablist">
      {([['all', 'All'], ['Movie', 'Movies'], ['TV', 'TV']] as const).map(([value, label]) => (
        <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: filter === value }} aria-selected={filter === value}
          onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.selected]}>
          <Text style={[styles.filterLabel, filter === value && styles.selectedLabel]}>{label}</Text>
        </Pressable>
      ))}
    </View>
    {loading ? <ActivityIndicator color={colors.accent} style={styles.message} accessibilityLabel="Loading viewing history" />
      : data?.status === 'unavailable' ? <View style={styles.message}>
        <Text accessibilityRole="alert" style={styles.secondary}>Viewing history could not be loaded.</Text>
        <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retry}><Text style={styles.title}>Try again</Text></Pressable>
      </View> : <FlatList data={records} keyExtractor={(item) => String(item.sequence)}
        contentContainerStyle={styles.list} renderItem={({ item }) => <ActivityRow event={item} />}
        ListEmptyComponent={<Text style={styles.secondary}>No viewing activity{filter === 'all' ? ' yet' : ` for ${filter === 'Movie' ? 'movies' : 'TV'}`}.</Text>} />}
  </SafeAreaView>;
}

function ActivityRow({ event }: { event: ViewingActivity }) {
  const styles = createStyles(useTheme());
  const [imageFailed, setImageFailed] = useState(false);
  const action = describeViewingAction(event.action);
  const time = new Date(event.happenedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return <Link href={{ pathname: event.title.mediaType === 'Movie' ? '/movie/[id]' : '/tv/[id]', params: { id: String(event.title.id) } }} asChild>
    <Pressable accessibilityRole="link" accessibilityLabel={`${event.title.title}, ${action}, ${formatLocalUkWatchedDate(event.happenedAt)} ${time}`}
      style={Platform.OS === 'web' ? styles.row : ({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.poster}>
        {event.title.posterUrl && !imageFailed ? <Image source={{ uri: event.title.posterUrl }} style={StyleSheet.absoluteFill}
          contentFit="cover" accessibilityLabel={`${event.title.title} poster`} onError={() => setImageFailed(true)} />
          : <Text style={styles.fallback}>{event.title.mediaType}</Text>}
      </View>
      <View style={styles.details}>
        <Text style={styles.title} numberOfLines={2}>{event.title.title}</Text>
        <Text style={styles.action}>{action}</Text>
        <Text style={styles.secondary}>{formatLocalUkWatchedDate(event.happenedAt)} · {time}</Text>
      </View>
    </Pressable>
  </Link>;
}

function createStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filters: { flexDirection: 'row', width: '90%', maxWidth: Layout.readingMaxWidth, alignSelf: 'center', marginVertical: 20, borderRadius: 8, backgroundColor: colors.surfaceMuted, padding: 4, gap: 4 },
  filter: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderRadius: 6 },
  selected: { backgroundColor: colors.accent },
  filterLabel: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  selectedLabel: { color: colors.onAccent },
  list: { paddingHorizontal: 24, paddingBottom: 32 },
  row: { flexDirection: 'row', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border, width: '100%', maxWidth: Layout.readingMaxWidth, alignSelf: 'center' },
  poster: { width: 64, height: 96, backgroundColor: colors.surfaceMuted, borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fallback: { color: colors.textSecondary, fontSize: 12 },
  details: { flex: 1, gap: 6, justifyContent: 'center' },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  action: { color: colors.accent, fontSize: 14, lineHeight: 21 },
  secondary: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
  message: { padding: 24, gap: 16, alignItems: 'center' },
  retry: { padding: 14 },
  pressed: { opacity: 0.65 },
});
}
