import { Image } from 'expo-image';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { BrandColors, ControlSize, Radii, Space } from '@/constants/design';
import { formatUkDate, getDeviceLocalIsoDate } from '@/services/air-date-rules';
import { getHomeSchedule, isFreshCompleteHomeSchedule, shouldShowTodayScheduleSection,
  type HomeScheduleRow, type ScheduleLoadResult } from '@/services/tv-schedule-rules';
import type { WatchlistItem } from '@/services/watchlist-rules';

function dayLabel(date: string, today: string) {
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  const current = new Date(`${today}T12:00:00Z`);
  current.setUTCDate(current.getUTCDate() + 1);
  return `${date === current.toISOString().slice(0, 10) ? 'Tomorrow · ' : ''}${day} · ${formatUkDate(date)}`;
}

function Row({ row, today, wide }: { row: HomeScheduleRow; today: string; wide: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const first = row.episodes[0];
  const count = row.episodes.length;
  const premiere = first.episodeNumber === 1
    ? first.seasonNumber === 1 ? 'Series premiere' : 'Season premiere' : null;
  return <View style={[styles.rowWrap, wide && styles.wideRowWrap]}>
    <Link href={{ pathname: '/tv/[id]', params: { id: String(row.id) } }} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={`Open ${row.title}, ${count} episode${count === 1 ? '' : 's'}, ${formatUkDate(row.date)}`}
        style={Platform.OS === 'web' ? styles.row : ({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.poster}>
          {row.posterUrl ? <Image source={{ uri: row.posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover"
            accessibilityLabel={`${row.title} poster`} />
            : <Text style={styles.posterFallback}>TV</Text>}
        </View>
        <View style={styles.details}>
          <Text style={styles.title} numberOfLines={2}>{row.title}</Text>
          <Text style={styles.meta} numberOfLines={2}>
            S{first.seasonNumber} E{first.episodeNumber}{first.name ? ` · ${first.name}` : ''}
            {count > 1 ? ` · ${count} episodes` : ''}
          </Text>
          {premiere && <Text style={styles.premiere}>{premiere}</Text>}
          {row.stale && <Text style={styles.meta}>Earlier schedule · checking</Text>}
        </View>
        <Text style={styles.dateBadge}>{row.date === today ? 'Today' : formatUkDate(row.date)}</Text>
      </Pressable>
    </Link>
    {count > 1 && <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? 'Hide' : 'Show'} all ${count} episodes of ${row.title}`}
      accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.expandButton}>
      <Text style={styles.expandText}>{expanded ? 'Hide episodes' : `Show ${count} episodes`}</Text>
    </Pressable>}
    {expanded && <View style={styles.episodeList}>{row.episodes.map((episode) =>
      <Text key={`${episode.seasonNumber}:${episode.episodeNumber}`} style={styles.meta}>
        S{episode.seasonNumber} E{episode.episodeNumber}{episode.name ? ` · ${episode.name}` : ''}
      </Text>)}</View>}
  </View>;
}

function SkeletonRows() {
  return <View style={styles.skeletonGroup} accessibilityLabel="Checking saved show schedules">
    {[0, 1].map((index) => <View key={index} style={styles.skeletonRow}>
      <View style={styles.skeletonPoster} /><View style={styles.skeletonCopy}>
        <View style={styles.skeletonLine} /><View style={[styles.skeletonLine, styles.skeletonShort]} />
      </View>
    </View>)}
  </View>;
}

export function UpcomingSection({ watchlist, cache, watchlistKnown = true, loading = false, checking = false,
  refreshFailed = false, onRetry }: {
  watchlist: WatchlistItem[]; cache: ScheduleLoadResult; watchlistKnown?: boolean; loading?: boolean;
  checking?: boolean; refreshFailed?: boolean; onRetry: () => Promise<void>;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const wide = windowWidth >= 1200;
  const [today, setToday] = useState(getDeviceLocalIsoDate);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [expandedWeek, setExpandedWeek] = useState(false);
  const [expandedSoon, setExpandedSoon] = useState(false);
  useFocusEffect(useCallback(() => {
    setToday(getDeviceLocalIsoDate());
    setNowMs(Date.now());
    const timer = setInterval(() => { setToday(getDeviceLocalIsoDate()); setNowMs(Date.now()); }, 60000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') { setToday(getDeviceLocalIsoDate()); setNowMs(Date.now()); }
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []));
  const savedIds = new Set(watchlist.filter((item) => item.mediaType === 'TV').map((item) => item.id));
  const records = cache.status === 'available' ? cache.records : [];
  const view = getHomeSchedule(records, savedIds, today);
  const freshComplete = isFreshCompleteHomeSchedule(records, savedIds, nowMs);
  const weekRows = view.weekDays.flatMap((day) => day.rows);
  const hasUpcoming = view.today.length + weekRows.length + view.comingSoon.length > 0;
  const visibleWeek = expandedWeek ? view.weekDays : view.weekDays.slice(0, 3);
  const visibleSoon = expandedSoon ? view.comingSoon : view.comingSoon.slice(0, 3);
  const showToday = shouldShowTodayScheduleSection(view);

  return <View style={styles.scheduleGroup}>
    {savedIds.size > 0 && !freshComplete && !loading &&
      <Text style={styles.meta}>Schedule may be incomplete.</Text>}
    {(refreshFailed || cache.status === 'unavailable') && !loading && <View style={styles.errorCard}>
      <Text accessibilityRole="alert" style={styles.message}>Couldn’t update your schedule.</Text>
      <Pressable accessibilityRole="button" disabled={checking} onPress={() => void onRetry()}
        style={({ pressed }) => [styles.retry, (checking || pressed) && styles.pressed]}>
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>}
    <View style={[styles.schedule, wide && styles.scheduleWide]}>
      {showToday && <View style={[styles.section, wide && styles.scheduleColumn]}>
        <Text accessibilityRole="header" style={styles.heading}>Today</Text>
        {view.today.map((row) => <Row key={`${row.id}:${row.date}`} row={row} today={today} wide={wide} />)}
        {(loading || (checking && !hasUpcoming)) && <SkeletonRows />}
        {!loading && watchlistKnown && savedIds.size === 0 && <View style={styles.emptyCard}>
          <Text style={styles.message}>Add TV shows to your Watchlist to see what’s coming up.</Text>
          <Link href="/search" style={styles.action}>Search shows</Link>
        </View>}
        {!loading && savedIds.size > 0 && !hasUpcoming && freshComplete && !refreshFailed &&
          <Text style={styles.meta}>No upcoming episode dates available yet.</Text>}
      </View>}

      {visibleWeek.length > 0 && <View style={[styles.section, wide && styles.scheduleColumn]}>
        <Text accessibilityRole="header" style={styles.heading}>This Week</Text>
        {visibleWeek.map((day) => <View key={day.date} style={styles.dayGroup}>
          {!wide && <Text style={styles.dayHeading}>{dayLabel(day.date, today)}</Text>}
          {day.rows.map((row) => <Row key={`${row.id}:${row.date}`} row={row} today={today} wide={wide} />)}
        </View>)}
        {view.weekDays.length > visibleWeek.length && <Pressable accessibilityRole="button"
          onPress={() => setExpandedWeek(true)} style={styles.expandButton}>
          <Text style={styles.expandText}>Show the rest of this week</Text>
        </Pressable>}
      </View>}

      {visibleSoon.length > 0 && <View style={[styles.section, wide && styles.scheduleColumn]}>
        <Text accessibilityRole="header" style={styles.heading}>Coming Soon</Text>
        {visibleSoon.map((row) => <Row key={`${row.id}:${row.date}`} row={row} today={today} wide={wide} />)}
        {view.comingSoon.length > visibleSoon.length && <Pressable accessibilityRole="button"
          onPress={() => setExpandedSoon(true)} style={styles.expandButton}>
          <Text style={styles.expandText}>Show more upcoming episodes</Text>
        </Pressable>}
      </View>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  scheduleGroup: { gap: Space.sm },
  schedule: { gap: Space.xl },
  scheduleWide: { flexDirection: 'row', alignItems: 'flex-start' },
  scheduleColumn: { flex: 1, minWidth: 0 },
  section: { gap: Space.sm },
  heading: { color: BrandColors.text, fontSize: 21, fontWeight: '800' },
  dayGroup: { gap: Space.xs },
  dayHeading: { color: BrandColors.goldBright, fontSize: 13, fontWeight: '700', marginTop: Space.sm },
  rowWrap: { borderBottomWidth: 1, borderBottomColor: BrandColors.border },
  wideRowWrap: { backgroundColor: BrandColors.surfaceRaised, borderWidth: 1,
    borderColor: BrandColors.border, borderRadius: Radii.md, paddingHorizontal: Space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, minHeight: 76, paddingVertical: Space.sm },
  poster: { width: 46, height: 66, borderRadius: Radii.sm, backgroundColor: BrandColors.surfaceRaised,
    overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  posterFallback: { color: BrandColors.textMuted, fontSize: 12, fontWeight: '700' },
  details: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: BrandColors.text, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  meta: { color: BrandColors.textMuted, fontSize: 12, lineHeight: 17 },
  premiere: { color: BrandColors.success, fontSize: 11, fontWeight: '700' },
  dateBadge: { color: BrandColors.goldBright, fontSize: 11, fontWeight: '700', textAlign: 'right', maxWidth: 72 },
  expandButton: { minHeight: ControlSize.minimum, justifyContent: 'center', alignSelf: 'flex-start', paddingRight: Space.md },
  expandText: { color: BrandColors.goldBright, fontSize: 13, fontWeight: '700' },
  episodeList: { paddingLeft: 58, paddingBottom: Space.sm, gap: Space.xs },
  emptyCard: { backgroundColor: BrandColors.surface, borderRadius: Radii.md, padding: Space.md, gap: Space.sm },
  message: { color: BrandColors.text, fontSize: 14, lineHeight: 20 },
  action: { color: BrandColors.goldBright, fontSize: 14, fontWeight: '700', minHeight: ControlSize.minimum,
    textAlignVertical: 'center' },
  errorCard: { backgroundColor: BrandColors.surface, borderRadius: Radii.md, padding: Space.md, gap: Space.sm },
  retry: { alignSelf: 'flex-start', backgroundColor: BrandColors.gold, borderRadius: Radii.pill,
    minHeight: ControlSize.minimum, paddingHorizontal: Space.lg, justifyContent: 'center' },
  retryText: { color: BrandColors.onGold, fontWeight: '700' },
  pressed: { opacity: 0.65 },
  skeletonGroup: { gap: Space.sm },
  skeletonRow: { flexDirection: 'row', gap: Space.md, alignItems: 'center' },
  skeletonPoster: { width: 46, height: 66, borderRadius: Radii.sm, backgroundColor: BrandColors.surfaceRaised },
  skeletonCopy: { flex: 1, gap: Space.sm },
  skeletonLine: { width: '70%', height: 12, borderRadius: 6, backgroundColor: BrandColors.surfaceRaised },
  skeletonShort: { width: '42%' },
});
