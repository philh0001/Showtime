import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileSettings } from '@/components/profile-settings';
import { IPhoneInstallHelp } from '@/components/iphone-install-guide';
import { BrandColors, ControlSize, Layout, Radii, Space } from '@/constants/design';
import { useAuth } from '@/hooks/use-auth';
import { loadHomeData, type HomeData } from '@/services/home-data';
import { subscribeLibraryChanges } from '@/services/library-changes';
import { loadMovieProgress } from '@/services/movie-progress';
import { formatActivityAge, getProfileActivityPreview } from '@/services/profile-activity';
import { loadRecentlyViewed } from '@/services/recently-viewed';
import { loadTvProgress } from '@/services/tv-progress';
import { loadTvSchedules } from '@/services/tv-schedule';
import { loadViewingActivity } from '@/services/viewing-activity';
import { describeViewingAction, type ActivityLoadResult, type ViewingActivity } from '@/services/viewing-activity-rules';
import { getViewingStats } from '@/services/viewing-summary';
import { loadWatchlist } from '@/services/watchlist';

export default function ProfileScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const desktop = windowWidth >= 900;
  const [data, setData] = useState<HomeData | null>(null);
  const [activity, setActivity] = useState<ActivityLoadResult | null>(null);
  const [loading, setLoading] = useState(true);
  const { status, user, syncing, lastSyncError } = useAuth();
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    const [nextData, nextActivity] = await Promise.all([
      loadHomeData({ loadRecentlyViewed, loadWatchlist, loadMovieProgress, loadTvProgress, loadTvSchedules }),
      loadViewingActivity().catch((): ActivityLoadResult => ({ status: 'unavailable' })),
    ]);
    if (current !== request.current) return;
    setData(nextData);
    setActivity(nextActivity);
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => {
    void refresh();
    const unsubscribe = subscribeLibraryChanges((origin) => { if (origin === 'remote') void refresh(); });
    return () => { unsubscribe(); request.current += 1; };
  }, [refresh]));

  const stats = data ? getViewingStats(data.watchlist, data.movieProgress, data.tvProgress) : null;
  const hasError = stats && Object.values(stats).some((value) => value === null);
  const recent = activity?.status === 'available' ? getProfileActivityPreview(activity.records) : [];
  const email = status === 'signedIn' ? user?.email : null;
  const accountName = email ?? 'Your profile';
  const initial = email?.charAt(0).toUpperCase() ?? 'S';

  return <SafeAreaView style={styles.container}>
    <ScrollView contentContainerStyle={[styles.content, desktop && styles.desktopContent]}>
      <Text accessibilityRole="header" style={[styles.title, desktop && styles.desktopTitle]}>Profile</Text>
      <View style={styles.identity}>
        <View style={styles.avatar} accessible accessibilityLabel={`${accountName} avatar`}><Text style={styles.avatarText}>{initial}</Text></View>
        <View style={styles.identityText}>
          <Text numberOfLines={1} style={styles.accountName}>{accountName}</Text>
          <Text style={styles.muted}>Your viewing, at a glance.</Text>
        </View>
        <Link href="/account" accessibilityLabel="Manage account" style={styles.accountShortcut}>›</Link>
      </View>

      {loading && <ActivityIndicator style={styles.loading} color={BrandColors.gold} accessibilityLabel="Loading profile" />}
      {!loading && stats && <>
        <View style={styles.stats}>
          <Stat label="Shows tracked" value={stats.showsTracked} divider />
          <Stat label="Episodes watched" value={stats.episodesWatched} divider />
          <Stat label="Movies watched" value={stats.moviesWatched} />
        </View>
        <Text style={styles.statsNote}>Episodes count individually tracked viewing.</Text>
        <Text style={styles.summary}>
          {stats.watchlist !== null ? `${stats.watchlist} titles in Watchlist` : 'Watchlist unavailable'}
          {'  ·  '}
          {stats.seasonsWatched !== null ? `${stats.seasonsWatched} TV seasons watched` : 'TV seasons unavailable'}
        </Text>
      </>}
      {!loading && hasError && <View style={styles.infoCard}>
        <Text accessibilityRole="alert" style={styles.error}>Some viewing statistics could not be loaded.</Text>
        <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retry}><Text style={styles.inlineLink}>Try again</Text></Pressable>
      </View>}

      <View style={[styles.sections, desktop && styles.desktopSections]}>
      <View style={[styles.mainColumn, desktop && styles.desktopMainColumn]}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text accessibilityRole="header" style={styles.heading}>Recent Activity</Text>
          <Link href="/history" style={styles.seeAll}>See all ›</Link>
        </View>
        {loading ? <View style={styles.activityCard}><ActivityIndicator color={BrandColors.gold} accessibilityLabel="Loading recent activity" /></View>
          : activity?.status === 'unavailable' ? <View style={styles.activityCard}>
            <Text accessibilityRole="alert" style={styles.muted}>Recent activity could not be loaded.</Text>
            <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retry}><Text style={styles.inlineLink}>Try again</Text></Pressable>
          </View> : recent.length === 0 ? <View style={styles.activityCard}>
            <Text style={styles.muted}>Mark a movie or episode watched to see it here.</Text>
            <Link href="/search" style={styles.inlineLink}>Find something to watch ›</Link>
          </View>
            : <View style={styles.activityList}>{recent.map((event) => <ActivityRow key={event.id ?? event.sequence} event={event} />)}</View>}
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>Your Library</Text>
        <View style={styles.linkCard}>
          <Link href="/watchlist" style={styles.cardLink}>Watchlist ›</Link>
        </View>
      </View>
      </View>

      <View style={[styles.sideColumn, desktop && styles.desktopSideColumn]}>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>Account</Text>
        <View style={styles.infoCard}>
          {status === 'signedIn' && user ? <>
            <Text numberOfLines={2} style={styles.cardTitle}>{user.email}</Text>
            <Text style={styles.muted}>{!user.emailVerified ? 'Verify your email to finish setting up your account.'
              : syncing ? 'Updating your account…'
                : lastSyncError ? 'Could not update your account just now.' : 'Your account is up to date.'}</Text>
            <Link href="/account" style={styles.inlineLink}>Manage account ›</Link>
          </> : <>
            <Text style={styles.muted}>Save your Watchlist and viewing progress to your account.</Text>
            <Link href="/account" style={styles.inlineLink}>Sign in or create an account ›</Link>
          </>}
        </View>
      </View>

      <ProfileSettings />
      <IPhoneInstallHelp />

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>About Showtime</Text>
        <View style={styles.infoCard}>
          <Text style={styles.muted}>Version {Constants.expoConfig?.version ?? '1.1.9'}</Text>
          <Text style={styles.muted}>{status === 'signedIn'
            ? 'Viewing data is saved on this device. A verified account can also store it for use elsewhere.'
            : 'Viewing data is saved on this device.'}</Text>
          <Link href="https://www.themoviedb.org" accessibilityLabel="Visit TMDB">
            <Image source={require('@/assets/images/tmdb-logo.svg')} style={styles.tmdb} contentFit="contain" accessibilityLabel="TMDB" />
          </Link>
          <Text style={styles.credit}>This product uses the TMDB API but is not endorsed or certified by TMDB.</Text>
        </View>
      </View>
      </View>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function Stat({ label, value, divider = false }: { label: string; value: number | null; divider?: boolean }) {
  return <View style={[styles.stat, divider && styles.statDivider]} accessible accessibilityLabel={`${label}: ${value ?? 'Unavailable'}`}>
    <Text style={styles.statValue}>{value ?? '—'}</Text><Text style={styles.statLabel}>{label}</Text>
  </View>;
}

function ActivityRow({ event }: { event: ViewingActivity }) {
  const [imageFailed, setImageFailed] = useState(false);
  const action = describeViewingAction(event.action);
  return <Link href={{ pathname: event.title.mediaType === 'Movie' ? '/movie/[id]' : '/tv/[id]', params: { id: String(event.title.id) } }} asChild>
    <Pressable accessibilityRole="link" accessibilityLabel={`${event.title.title}, ${action}, ${formatActivityAge(event.happenedAt)}`}
      style={Platform.OS === 'web' ? styles.activityRow : ({ pressed }) => [styles.activityRow, pressed && styles.pressed]}>
      <View style={styles.poster}>
        {event.title.posterUrl && !imageFailed ? <Image source={{ uri: event.title.posterUrl }} style={StyleSheet.absoluteFill}
          contentFit="cover" accessibilityLabel={`${event.title.title} poster`} onError={() => setImageFailed(true)} />
          : <Text style={styles.posterFallback}>{event.title.mediaType}</Text>}
      </View>
      <View style={styles.activityText}>
        <Text style={styles.activityTitle} numberOfLines={1}>{event.title.title}</Text>
        <Text style={styles.activityAction} numberOfLines={1}>{action}</Text>
      </View>
      <Text style={styles.activityAge}>{formatActivityAge(event.happenedAt)}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  </Link>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BrandColors.background },
  content: { alignSelf: 'center', width: '100%', maxWidth: Layout.maxContentWidth,
    paddingHorizontal: Layout.phonePadding, paddingTop: Space.lg, paddingBottom: Space.xxl, gap: Space.lg },
  desktopContent: { paddingHorizontal: Layout.pagePadding, paddingTop: Space.xl, gap: Space.xl },
  title: { color: BrandColors.text, fontSize: 28, fontWeight: '800' },
  desktopTitle: { fontSize: 32 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: BrandColors.gold, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: BrandColors.onGold, fontSize: 22, fontWeight: '800' },
  identityText: { flex: 1, minWidth: 0, gap: Space.xs },
  accountName: { color: BrandColors.text, fontSize: 16, fontWeight: '700' },
  accountShortcut: { color: BrandColors.textMuted, fontSize: 30, minWidth: ControlSize.minimum, minHeight: ControlSize.minimum, textAlign: 'center' },
  muted: { color: BrandColors.textMuted, fontSize: 14, lineHeight: 20 },
  loading: { marginVertical: Space.xl },
  stats: { flexDirection: 'row', backgroundColor: BrandColors.surfaceRaised, borderRadius: Radii.md, borderWidth: 1, borderColor: BrandColors.border, paddingVertical: Space.md },
  stat: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Space.xs, minHeight: 66, paddingHorizontal: Space.xs },
  statDivider: { borderRightWidth: 1, borderRightColor: BrandColors.border },
  statValue: { color: BrandColors.text, fontSize: 23, fontWeight: '800' },
  statLabel: { color: BrandColors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 17 },
  statsNote: { color: BrandColors.textMuted, fontSize: 12, marginTop: -Space.md },
  summary: { color: BrandColors.textMuted, fontSize: 12, marginTop: -Space.sm },
  sections: { gap: Space.lg },
  desktopSections: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.xl },
  mainColumn: { gap: Space.lg },
  sideColumn: { gap: Space.lg },
  desktopMainColumn: { flex: 1.6, minWidth: 0 },
  desktopSideColumn: { flex: 1, minWidth: 0 },
  section: { gap: Space.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { color: BrandColors.text, fontSize: 20, fontWeight: '800' },
  seeAll: { color: BrandColors.goldBright, fontSize: 14, fontWeight: '700', minHeight: ControlSize.minimum, paddingVertical: Space.md },
  activityCard: { backgroundColor: BrandColors.surfaceRaised, borderRadius: Radii.md, borderWidth: 1, borderColor: BrandColors.border, padding: Space.lg, minHeight: 76, justifyContent: 'center', gap: Space.sm },
  activityList: { backgroundColor: BrandColors.surface, borderRadius: Radii.md, overflow: 'hidden' },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, minHeight: 70, paddingHorizontal: Space.sm, paddingVertical: Space.xs, borderBottomWidth: 1, borderBottomColor: BrandColors.border },
  poster: { width: 40, height: 52, borderRadius: Radii.sm, backgroundColor: BrandColors.surfaceInteractive, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  posterFallback: { color: BrandColors.textMuted, fontSize: 10 },
  activityText: { flex: 1, minWidth: 0, gap: 3 },
  activityTitle: { color: BrandColors.text, fontSize: 15, fontWeight: '700' },
  activityAction: { color: BrandColors.textMuted, fontSize: 13 },
  activityAge: { color: BrandColors.textMuted, fontSize: 12 },
  chevron: { color: BrandColors.textMuted, fontSize: 23 },
  linkCard: { backgroundColor: BrandColors.surfaceRaised, borderRadius: Radii.md, borderWidth: 1, borderColor: BrandColors.border, overflow: 'hidden' },
  cardLink: { color: BrandColors.text, fontSize: 15, fontWeight: '700', padding: Space.lg, minHeight: ControlSize.minimum },
  infoCard: { backgroundColor: BrandColors.surfaceRaised, borderRadius: Radii.md, borderWidth: 1, borderColor: BrandColors.border, padding: Space.lg, gap: Space.sm },
  cardTitle: { color: BrandColors.text, fontSize: 15, fontWeight: '700' },
  inlineLink: { color: BrandColors.goldBright, fontSize: 14, fontWeight: '700', minHeight: ControlSize.minimum, paddingVertical: Space.md },
  tmdb: { width: 100, height: 24, marginTop: Space.xs },
  credit: { color: BrandColors.textMuted, fontSize: 12, lineHeight: 18 },
  error: { color: BrandColors.danger, fontSize: 14 },
  retry: { alignSelf: 'flex-start', minHeight: ControlSize.minimum, justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
