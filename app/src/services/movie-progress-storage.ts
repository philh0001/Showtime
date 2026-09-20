import {
  parseMovieProgress,
  setMovieUnwatched,
  setMovieWatched,
  type MovieProgressLoadResult,
  type WatchedMovie,
  type WatchedMovieSnapshot,
} from './movie-progress-rules.ts';

export const MOVIE_PROGRESS_KEY = 'showtime.movie-progress.v1';

type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export class MovieProgressUnavailableError extends Error {}

export function createMovieProgressStorage(
  storage: Storage,
  now = () => new Date().toISOString(),
) {
  async function load(): Promise<MovieProgressLoadResult> {
    try {
      return parseMovieProgress(await storage.getItem(MOVIE_PROGRESS_KEY));
    } catch {
      return { status: 'unavailable', reason: 'read-error' };
    }
  }

  async function update(
    change: (records: WatchedMovie[]) => WatchedMovie[],
  ) {
    const loaded = await load();
    if (loaded.status === 'unavailable') {
      throw new MovieProgressUnavailableError('Movie progress is unavailable.');
    }
    const records = change(loaded.records);
    await storage.setItem(MOVIE_PROGRESS_KEY, JSON.stringify(records));
    return records;
  }

  return {
    load,
    markWatched(snapshot: WatchedMovieSnapshot) {
      return update((records) => setMovieWatched(records, snapshot, now()));
    },
    markUnwatched(movieId: number) {
      return update((records) => setMovieUnwatched(records, movieId));
    },
  };
}
