import { Image } from 'expo-image';
import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MovieWatchedControl } from '@/components/movie-watched-control';
import { DetailExtras } from '@/components/detail-extras';
import { TvTrackingSection } from '@/components/tv-tracking-section';
import { formatUkDate } from '@/services/air-date-rules';
import { DetailsError, fetchDetails, type MediaDetails, type MediaType } from '@/services/details';
import { createWatchedMovieSnapshot } from '@/services/movie-progress-rules';
import { createRecentlyViewedSnapshot } from '@/services/recently-viewed-rules';
import { recordRecentlyViewed } from '@/services/recently-viewed';
import { recordTvSchedule } from '@/services/tv-schedule';
import { isInWatchlist, type WatchlistItem } from '@/services/watchlist-rules';
import { addToWatchlist, loadWatchlist, removeFromWatchlist } from '@/services/watchlist';
import { useTheme } from '@/hooks/use-theme';
import { getDetailsLayout } from '@/services/tv-tracking-layout-rules';
import { Layout } from '@/constants/theme';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; details: MediaDetails };

export default function MediaDetailsScreen({ mediaType }: { mediaType: MediaType }) {
  const styles = createStyles(useTheme());
  const { id } = useLocalSearchParams<{ id: string }>();
  if (typeof id !== 'string' || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
        <View style={styles.messageContainer}>
          <Text style={styles.body}>This title link is invalid.</Text>
          <Link href="/search" replace style={styles.link}>Return to Search</Link>
        </View>
      </SafeAreaView>
    );
  }
  // Changing the title remounts the loader and discards the previous result.
  return <DetailsLoader key={`${mediaType}-${id}`} mediaType={mediaType} id={id} />;
}

function DetailsLoader({ mediaType, id }: { mediaType: MediaType; id: string }) {
  const styles = createStyles(useTheme());
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 15000);
    async function load() {
      try {
        const details = await fetchDetails(mediaType, id, controller.signal);
        if (active) setState({ status: 'success', details });
      } catch (error) {
        if (active) setState({
          status: 'error',
          message: error instanceof DetailsError ? error.message : 'Could not load details. Check your connection and try again.',
        });
      } finally {
        clearTimeout(timeout);
      }
    }
    void load();
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [mediaType, id, attempt]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      {state.status === 'loading' && <View style={styles.messageContainer}>
        <ActivityIndicator color="#FFFFFF" accessibilityLabel="Loading title details" />
        <Text style={styles.body}>Loading details…</Text>
      </View>}
      {state.status === 'error' && <View style={styles.messageContainer}>
        <Text accessibilityRole="alert" style={styles.body}>{state.message}</Text>
        <Pressable accessibilityRole="button" style={styles.retry} onPress={() => {
          setState({ status: 'loading' });
          setAttempt((value) => value + 1);
        }}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
        <Link href="/search" replace style={styles.link}>Return to Search</Link>
      </View>}
      {state.status === 'success' && <DetailsContent details={state.details} />}
    </SafeAreaView>
  );
}

function DetailsContent({ details }: { details: MediaDetails }) {
  const styles = createStyles(useTheme());
  const { width } = useWindowDimensions();
  const split = getDetailsLayout(width) === 'split';
  const [saved, setSaved] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);

  useEffect(() => {
    void recordRecentlyViewed(createRecentlyViewedSnapshot(details)).catch(() => undefined);
    void recordTvSchedule(details).catch(() => undefined);
  }, [details]);

  useEffect(() => {
    let active = true;
    loadWatchlist()
      .then((watchlist) => {
        if (active) setSaved(isInWatchlist(watchlist, details.id, details.mediaType));
      })
      .catch(() => {
        if (active) setWatchlistError('Could not read your watchlist.');
      });
    return () => {
      active = false;
    };
  }, [details.id, details.mediaType]);

  async function toggleWatchlist() {
    if (saved === null || saving) return;
    setSaving(true);
    setWatchlistError(null);
    try {
      if (saved) {
        await removeFromWatchlist(details.id, details.mediaType);
      } else {
        const item: WatchlistItem = {
          id: details.id,
          mediaType: details.mediaType,
          title: details.title,
          year: details.releaseDate?.slice(0, 4) ?? null,
          posterUrl: details.posterUrl,
        };
        await addToWatchlist(item);
      }
      setSaved(!saved);
    } catch {
      setWatchlistError('Could not update your watchlist. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.content}>
        <Artwork url={details.backdropUrl} label={`${details.title} backdrop`} wide />
        <View style={[styles.detailsColumns, split && styles.detailsColumnsWide]}>
        <View style={[styles.summaryColumn, split && styles.summaryColumnWide]}>
        <View style={styles.summary}>
          <Artwork url={details.posterUrl} label={`${details.title} poster`} />
          <View style={styles.titleBlock}>
            <Text accessibilityRole="header" style={styles.title}>{details.title}</Text>
            <Text style={styles.secondary}>{details.mediaType} · {details.releaseDate?.slice(0, 4) ?? 'Year unknown'}</Text>
            <Text style={styles.body}>{details.rating === null ? 'Not yet rated' : `${details.rating.toFixed(1)} / 10 on TMDB`}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: saved === null || saving, busy: saving }}
          disabled={saved === null || saving}
          onPress={() => void toggleWatchlist()}
          style={({ pressed }) => [styles.watchlistButton, pressed && styles.dimmed]}
        >
          <Text style={styles.watchlistButtonText}>
            {saving ? 'Updatingâ€¦' : saved ? 'Remove from Watchlist' : 'Add to Watchlist'}
          </Text>
        </Pressable>
        {watchlistError && <Text accessibilityRole="alert" style={styles.error}>{watchlistError}</Text>}
        {details.mediaType === 'Movie'
          && <MovieWatchedControl snapshot={createWatchedMovieSnapshot(details)} />}
        <Text style={styles.secondary}>
          {details.mediaType === 'Movie' ? 'Release date' : 'First aired'}: {formatDate(details.releaseDate)}
        </Text>
        </View>
        <View style={[styles.bodyColumn, split && styles.bodyColumnWide]}>
        <Text accessibilityRole="header" style={styles.heading}>Overview</Text>
        <Text style={styles.body}>{details.overview ?? 'No description is available yet.'}</Text>
        <Text accessibilityRole="header" style={styles.heading}>Genres</Text>
        <Text style={styles.body}>{details.genres.length ? details.genres.join(' · ') : 'Genres unavailable'}</Text>
        {details.mediaType === 'TV' && <TvTrackingSection details={details} />}
        <DetailExtras cast={details.cast} crew={details.crew} trailer={details.trailer} mediaType={details.mediaType} />
        <View style={styles.credits}>
          <Text style={styles.secondary}>Credits</Text>
          <Link href="https://www.themoviedb.org" accessibilityLabel="Visit TMDB">
            <Image source={require('@/assets/images/tmdb-logo.svg')} style={styles.tmdbLogo} contentFit="contain" accessibilityLabel="TMDB" />
          </Link>
          <Text style={styles.secondary}>This product uses the TMDB API but is not endorsed or certified by TMDB.</Text>
        </View>
        </View>
        </View>
      </View>
    </ScrollView>
  );
}

function Artwork({ url, label, wide = false }: { url: string | null; label: string; wide?: boolean }) {
  const [failed, setFailed] = useState(false);
  const styles = createStyles(useTheme());
  return (
    <View style={[styles.artwork, wide ? styles.backdrop : styles.poster]}>
      {url && !failed
        ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={label} onError={() => setFailed(true)} />
        : <Text style={styles.artworkFallback}>{wide ? 'No backdrop' : 'No poster'}</Text>}
    </View>
  );
}

function formatDate(value: string | null) {
  return formatUkDate(value) ?? 'Unknown';
}

function createStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 32, alignItems: 'center' },
  content: { width: '100%', maxWidth: Layout.contentMaxWidth, padding: 24 },
  messageContainer: { padding: 24, gap: 20, alignItems: 'center' },
  artwork: { overflow: 'hidden', borderRadius: 12, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  backdrop: { width: '100%', aspectRatio: 16 / 9 },
  poster: { width: 100, height: 150 },
  artworkFallback: { color: colors.textSecondary, fontSize: 13 },
  detailsColumns: { width: '100%' },
  detailsColumnsWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 32 },
  summaryColumn: { minWidth: 0 },
  summaryColumnWide: { flexBasis: 320, flexGrow: 0, flexShrink: 0 },
  bodyColumn: { minWidth: 0 },
  bodyColumnWide: { flex: 1 },
  summary: { flexDirection: 'row', gap: 16, marginVertical: 24, alignItems: 'center' },
  titleBlock: { flex: 1, gap: 8 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  heading: { color: colors.text, fontSize: 21, fontWeight: '700', marginTop: 24, marginBottom: 12 },
  body: { color: colors.text, fontSize: 16, lineHeight: 25 },
  secondary: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  retry: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 14 },
  retryText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },
  watchlistButton: { minHeight: 48, backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center' },
  watchlistButtonText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },
  dimmed: { opacity: 0.65 },
  error: { color: colors.danger, fontSize: 14, marginTop: 10 },
  link: { color: colors.accent, fontSize: 16, paddingVertical: 12, textDecorationLine: 'underline' },
  credits: { marginTop: 32, gap: 12 },
  tmdbLogo: { width: 100, height: 24 },
});
}
