import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  commitMovieProgressChange,
  findWatchedMovie,
  formatLocalUkWatchedDate,
  setMovieUnwatched,
  setMovieWatched,
  type WatchedMovie,
  type WatchedMovieSnapshot,
} from '@/services/movie-progress-rules';
import {
  loadMovieProgress,
  markMovieUnwatched,
  markMovieWatched,
} from '@/services/movie-progress';

type LoadStatus = 'loading' | 'available' | 'unavailable';

export function MovieWatchedControl({ snapshot }: { snapshot: WatchedMovieSnapshot }) {
  const [records, setRecords] = useState<WatchedMovie[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    loadMovieProgress()
      .then((result) => {
        if (!active) return;
        if (result.status === 'available') {
          setRecords(result.records);
          setStatus('available');
        } else {
          setStatus('unavailable');
        }
      })
      .catch(() => {
        if (active) setStatus('unavailable');
      });
    return () => {
      active = false;
    };
  }, [snapshot.movieId, loadAttempt]);

  const watched = findWatchedMovie(records, snapshot.movieId);

  function retryLoad() {
    setStatus('loading');
    setError(null);
    setLoadAttempt((value) => value + 1);
  }

  async function toggleWatched() {
    if (status !== 'available' || saving) return;
    const previous = records;
    const optimistic = watched
      ? setMovieUnwatched(previous, snapshot.movieId)
      : setMovieWatched(previous, snapshot, new Date().toISOString());
    setRecords(optimistic);
    setSaving(true);
    setError(null);

    const result = await commitMovieProgressChange(previous, () => watched
      ? markMovieUnwatched(snapshot.movieId)
      : markMovieWatched(snapshot));
    setRecords(result.records);
    if (!result.saved) {
      setError('Could not update watched status. Please try again.');
    }
    setSaving(false);
  }

  if (status === 'unavailable') {
    return (
      <View style={styles.errorGroup}>
        <Text accessibilityRole="alert" style={styles.error}>
          Movie watched status is unavailable.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={retryLoad}
          style={({ pressed }) => [styles.retryButton, pressed && styles.dimmed]}
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const watchedDate = watched ? formatLocalUkWatchedDate(watched.watchedAt) : null;
  return (
    <View style={styles.group}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: status === 'loading' || saving, busy: saving }}
        disabled={status === 'loading' || saving}
        onPress={() => void toggleWatched()}
        style={({ pressed }) => [styles.button, pressed && styles.dimmed]}
      >
        <Text style={styles.buttonText}>
          {status === 'loading'
            ? 'Loading watched status…'
            : saving
              ? 'Updating…'
              : watched
                ? 'Mark as unwatched'
                : 'Mark as watched'}
        </Text>
      </Pressable>
      {watchedDate && <Text style={styles.watchedDate}>Watched {watchedDate}</Text>}
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8, marginTop: 12 },
  errorGroup: { alignItems: 'flex-start', gap: 10, marginTop: 12 },
  button: {
    alignItems: 'center',
    borderColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  watchedDate: { color: '#A7A7B0', fontSize: 14, textAlign: 'center' },
  error: { color: '#FF8A8A', fontSize: 14 },
  retryButton: {
    borderColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  dimmed: { opacity: 0.65 },
});
