import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileSettings } from '@/components/profile-settings';
import { IPhoneInstallHelp } from '@/components/iphone-install-guide';
import { useAuth } from '@/hooks/use-auth';
import { subscribeLibraryChanges } from '@/services/library-changes';

import { loadHomeData, type HomeData } from '@/services/home-data';
import { loadMovieProgress } from '@/services/movie-progress';
import { loadRecentlyViewed } from '@/services/recently-viewed';
import { loadTvProgress } from '@/services/tv-progress';
import { loadTvSchedules } from '@/services/tv-schedule';
import { getViewingStats } from '@/services/viewing-summary';
import { loadWatchlist } from '@/services/watchlist';

export default function ProfileScreen() {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const { status, user, syncing } = useAuth();
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
  const stats = data ? getViewingStats(data.watchlist, data.movieProgress, data.tvProgress) : null;
  const hasError = stats && Object.values(stats).some((value) => value === null);
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Your viewing activity</Text>
        {loading ? <ActivityIndicator style={styles.loading} color="#FFFFFF" accessibilityLabel="Loading viewing statistics" />
          : stats && <View style={styles.stats}>
            <Stat label="Titles in Watchlist" value={stats.watchlist} />
            <Stat label="Movies watched" value={stats.moviesWatched} />
            <Stat label="TV seasons watched" value={stats.seasonsWatched} />
            <Stat label="Shows with viewing progress" value={stats.showsTracked} />
            <Stat label="Individually tracked episodes watched" value={stats.episodesWatched} />
          </View>}
        {!loading && hasError && <View style={styles.errorGroup}>
          <Text accessibilityRole="alert" style={styles.error}>Some viewing statistics could not be loaded.</Text>
          <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retry}>
            <Text style={styles.link}>Try again</Text>
          </Pressable>
        </View>}
        <Link href="/watchlist" style={styles.navigation}>Watchlist</Link>
        <Link href="/history" style={styles.navigation}>Viewing history</Link>
        <View style={styles.accountSection}>
          <Text accessibilityRole="header" style={styles.heading}>Account</Text>
          {status === 'signedIn' && user ? (
            <>
              <Text style={styles.subtitle}>Signed in as {user.email}</Text>
              <Text style={styles.subtitle}>
                {!user.emailVerified ? 'Verify your email to sync across devices.'
                  : syncing ? 'Syncing…' : 'Synced across your devices.'}
              </Text>
              <Link href="/account" style={styles.navigation}>Manage account</Link>
            </>
          ) : (
            <>
              <Text style={styles.subtitle}>Sign in to keep your Watchlist and progress in sync across devices.</Text>
              <Link href="/account" style={styles.navigation}>Sign in or create an account</Link>
            </>
          )}
        </View>
        <ProfileSettings />
        <IPhoneInstallHelp />
        <View style={styles.about}>
          <Text accessibilityRole="header" style={styles.heading}>About Showtime</Text>
          <Text style={styles.subtitle}>Version {Constants.expoConfig?.version ?? '1.1.2'}</Text>
          <Text style={styles.subtitle}>
            {status === 'signedIn' ? 'Viewing data is saved on this device and, once verified, synced to your account.'
              : 'Viewing data is saved on this device.'}
          </Text>
          <Link href="https://www.themoviedb.org" accessibilityLabel="Visit TMDB">
            <Image source={require('@/assets/images/tmdb-logo.svg')} style={styles.tmdb} contentFit="contain" accessibilityLabel="TMDB" />
          </Link>
          <Text style={styles.credit}>This product uses the TMDB API but is not endorsed or certified by TMDB.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value ?? 'Unavailable'}`}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value ?? '?'}</Text>
  </View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0F',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#A7A7B0',
    fontSize: 16,
    lineHeight: 24,
  },
  loading: { marginVertical: 40 },
  stats: { marginTop: 12 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#29292F' },
  statLabel: { flex: 1, color: '#DDDEE3', fontSize: 16, lineHeight: 23 },
  statValue: { color: '#63D7BA', fontSize: 24, fontWeight: '700', minWidth: 44, textAlign: 'right' },
  navigation: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', paddingVertical: 12 },
  accountSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#29292F', gap: 6 },
  about: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#29292F', gap: 10 },
  heading: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  tmdb: { width: 100, height: 24, marginTop: 4 },
  credit: { color: '#A7A7B0', fontSize: 13, lineHeight: 20 },
  errorGroup: { marginTop: 20, alignItems: 'flex-start' },
  error: { color: '#FF8A8A', fontSize: 14 },
  retry: { paddingVertical: 14 },
  link: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
