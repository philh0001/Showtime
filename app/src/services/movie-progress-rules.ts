export type WatchedMovieSnapshot = {
  movieId: number;
  title: string;
  year: string | null;
  posterUrl: string | null;
};

export type WatchedMovie = WatchedMovieSnapshot & {
  watchedAt: string;
};

export type MovieProgressLoadResult =
  | { status: 'available'; records: WatchedMovie[] }
  | { status: 'unavailable'; reason: 'malformed' | 'read-error' };

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function normalizeRecord(value: unknown): WatchedMovie | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (!isPositiveSafeInteger(record.movieId)
    || typeof record.title !== 'string' || !record.title.trim()
    || (record.year !== null && typeof record.year !== 'string')
    || (record.posterUrl !== null && typeof record.posterUrl !== 'string')
    || !isIsoTimestamp(record.watchedAt)) return null;
  return {
    movieId: record.movieId,
    title: record.title.trim(),
    year: record.year,
    posterUrl: record.posterUrl,
    watchedAt: record.watchedAt,
  };
}

export function normalizeMovieProgress(values: unknown[]) {
  const newest = new Map<number, WatchedMovie>();
  for (const value of values) {
    const record = normalizeRecord(value);
    if (!record) continue;
    const current = newest.get(record.movieId);
    if (!current || record.watchedAt > current.watchedAt) {
      newest.set(record.movieId, record);
    }
  }
  return [...newest.values()].sort((a, b) => b.watchedAt.localeCompare(a.watchedAt)
    || a.movieId - b.movieId);
}

export function parseMovieProgress(stored: string | null): MovieProgressLoadResult {
  if (stored === null) return { status: 'available', records: [] };
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? { status: 'available', records: normalizeMovieProgress(parsed) }
      : { status: 'unavailable', reason: 'malformed' };
  } catch {
    return { status: 'unavailable', reason: 'malformed' };
  }
}

export function findWatchedMovie(records: WatchedMovie[], movieId: number) {
  return records.find((record) => record.movieId === movieId) ?? null;
}

export function setMovieWatched(
  records: WatchedMovie[],
  snapshot: WatchedMovieSnapshot,
  watchedAt: string,
) {
  return normalizeMovieProgress([
    { ...snapshot, watchedAt },
    ...records.filter((record) => record.movieId !== snapshot.movieId),
  ]);
}

export function setMovieUnwatched(records: WatchedMovie[], movieId: number) {
  if (!isPositiveSafeInteger(movieId)) return normalizeMovieProgress(records);
  return normalizeMovieProgress(records.filter((record) => record.movieId !== movieId));
}

export function createWatchedMovieSnapshot(details: {
  id: number;
  title: string;
  releaseDate: string | null;
  posterUrl: string | null;
}): WatchedMovieSnapshot {
  return {
    movieId: details.id,
    title: details.title,
    year: details.releaseDate?.slice(0, 4) ?? null,
    posterUrl: details.posterUrl,
  };
}

export function formatLocalUkWatchedDate(timestamp: string) {
  if (!isIsoTimestamp(timestamp)) return null;
  const date = new Date(timestamp);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export async function commitMovieProgressChange(
  previous: WatchedMovie[],
  write: () => Promise<WatchedMovie[]>,
) {
  try {
    return { saved: true as const, records: await write() };
  } catch {
    return { saved: false as const, records: previous };
  }
}
