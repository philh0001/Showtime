import { Image } from 'expo-image';
import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailsError, fetchDetails, type MediaDetails, type MediaType } from '@/services/details';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; details: MediaDetails };

export default function MediaDetailsScreen({ mediaType }: { mediaType: MediaType }) {
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
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.content}>
        <Artwork url={details.backdropUrl} label={`${details.title} backdrop`} wide />
        <View style={styles.summary}>
          <Artwork url={details.posterUrl} label={`${details.title} poster`} />
          <View style={styles.titleBlock}>
            <Text accessibilityRole="header" style={styles.title}>{details.title}</Text>
            <Text style={styles.secondary}>{details.mediaType} · {details.releaseDate?.slice(0, 4) ?? 'Year unknown'}</Text>
            <Text style={styles.body}>{details.rating === null ? 'Not yet rated' : `${details.rating.toFixed(1)} / 10 on TMDB`}</Text>
          </View>
        </View>
        <Text style={styles.secondary}>
          {details.mediaType === 'Movie' ? 'Release date' : 'First aired'}: {formatDate(details.releaseDate)}
        </Text>
        <Text accessibilityRole="header" style={styles.heading}>Overview</Text>
        <Text style={styles.body}>{details.overview ?? 'No description is available yet.'}</Text>
        <Text accessibilityRole="header" style={styles.heading}>Genres</Text>
        <Text style={styles.body}>{details.genres.length ? details.genres.join(' · ') : 'Genres unavailable'}</Text>
        {details.mediaType === 'TV' && <View>
          <Text accessibilityRole="header" style={styles.heading}>Seasons</Text>
          {details.seasons.length ? details.seasons.map((season) => (
            <View key={season.id} style={styles.season}>
              <Text style={styles.seasonTitle}>{season.name}</Text>
              <Text style={styles.secondary}>
                {season.episodeCount === null ? 'Episode count unknown' : `${season.episodeCount} episode${season.episodeCount === 1 ? '' : 's'}`}
                {' · '}{season.airDate?.slice(0, 4) ?? 'Year unknown'}
              </Text>
            </View>
          )) : <Text style={styles.body}>Season information is unavailable.</Text>}
        </View>}
        <View style={styles.credits}>
          <Text style={styles.secondary}>Credits</Text>
          <Link href="https://www.themoviedb.org" accessibilityLabel="Visit TMDB">
            <Image source={require('@/assets/images/tmdb-logo.svg')} style={styles.tmdbLogo} contentFit="contain" accessibilityLabel="TMDB" />
          </Link>
          <Text style={styles.secondary}>This product uses the TMDB API but is not endorsed or certified by TMDB.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function Artwork({ url, label, wide = false }: { url: string | null; label: string; wide?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[styles.artwork, wide ? styles.backdrop : styles.poster]}>
      {url && !failed
        ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={label} onError={() => setFailed(true)} />
        : <Text style={styles.artworkFallback}>{wide ? 'No backdrop' : 'No poster'}</Text>}
    </View>
  );
}

function formatDate(value: string | null) {
  if (!value) return 'Unknown';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0F' },
  scrollContent: { paddingBottom: 32, alignItems: 'center' },
  content: { width: '100%', maxWidth: 800, padding: 24 },
  messageContainer: { padding: 24, gap: 20, alignItems: 'center' },
  artwork: { overflow: 'hidden', borderRadius: 12, backgroundColor: '#212225', alignItems: 'center', justifyContent: 'center' },
  backdrop: { width: '100%', aspectRatio: 16 / 9 },
  poster: { width: 100, height: 150 },
  artworkFallback: { color: '#A7A7B0', fontSize: 13 },
  summary: { flexDirection: 'row', gap: 16, marginVertical: 24, alignItems: 'center' },
  titleBlock: { flex: 1, gap: 8 },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
  heading: { color: '#FFFFFF', fontSize: 21, fontWeight: '700', marginTop: 24, marginBottom: 12 },
  body: { color: '#FFFFFF', fontSize: 16, lineHeight: 25 },
  secondary: { color: '#A7A7B0', fontSize: 14, lineHeight: 22 },
  season: { gap: 4, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#393940' },
  seasonTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  retry: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 14 },
  retryText: { color: '#0B0B0F', fontSize: 16, fontWeight: '700' },
  link: { color: '#FFFFFF', fontSize: 16, paddingVertical: 12, textDecorationLine: 'underline' },
  credits: { marginTop: 32, gap: 12 },
  tmdbLogo: { width: 100, height: 24 },
});
