import {
  calculateEpisodeProgress,
  calculateTvProgress,
  findTvProgress,
  type ProgressLoadResult,
} from './tv-progress-rules.ts';
import {
  findWatchedMovie,
  type MovieProgressLoadResult,
} from './movie-progress-rules.ts';
import type { WatchlistItem } from './watchlist-rules.ts';

type LocalLoaders = {
  loadWatchlist: () => Promise<WatchlistItem[]>;
  loadTvProgress: () => Promise<ProgressLoadResult>;
  loadMovieProgress: () => Promise<MovieProgressLoadResult>;
};

export type WatchlistFilter = 'all' | 'to-watch' | 'watched';
export type WatchlistStatus = 'watched' | 'to-watch' | 'unknown';

export async function loadWatchlistProgressData(loaders: LocalLoaders) {
  const [itemsResult, tvResult, movieResult] = await Promise.allSettled([
    loaders.loadWatchlist(),
    loaders.loadTvProgress(),
    loaders.loadMovieProgress(),
  ]);
  if (itemsResult.status === 'rejected') throw itemsResult.reason;
  return {
    items: itemsResult.value,
    tvProgress: tvResult.status === 'fulfilled'
      ? tvResult.value
      : { status: 'unavailable' as const, reason: 'read-error' as const },
    movieProgress: movieResult.status === 'fulfilled'
      ? movieResult.value
      : { status: 'unavailable' as const, reason: 'read-error' as const },
  };
}

export function getWatchlistStatus(
  item: WatchlistItem,
  tvProgress: ProgressLoadResult,
  movieProgress: MovieProgressLoadResult,
): WatchlistStatus {
  if (item.mediaType === 'Movie') {
    if (movieProgress.status === 'unavailable') return 'unknown';
    return findWatchedMovie(movieProgress.records, item.id) ? 'watched' : 'to-watch';
  }
  if (tvProgress.status === 'unavailable') return 'unknown';
  const record = findTvProgress(tvProgress.records, item.id);
  if (!record) return 'to-watch';
  const total = calculateTvProgress(record);
  return total.total > 0 && total.watched === total.total ? 'watched' : 'to-watch';
}

export function filterWatchlistItems(
  items: WatchlistItem[],
  filter: WatchlistFilter,
  tvProgress: ProgressLoadResult,
  movieProgress: MovieProgressLoadResult,
) {
  if (filter === 'all') return items;
  return items.filter((item) => getWatchlistStatus(item, tvProgress, movieProgress) === filter);
}

export function getWatchlistProgressLabel(
  item: WatchlistItem,
  progress: ProgressLoadResult,
) {
  if (item.mediaType === 'Movie') return null;
  if (progress.status === 'unavailable') return 'Season progress unavailable';
  const record = findTvProgress(progress.records, item.id);
  if (!record) return 'Open details to load season progress';
  const total = calculateTvProgress(record);
  const seasonLabel = `${total.watched} of ${total.total} seasons watched`;
  const latestEpisodes = record.episodeProgress.at(-1);
  if (!latestEpisodes) return seasonLabel;
  const episodes = calculateEpisodeProgress(latestEpisodes);
  return episodes.total > 0
    ? `${seasonLabel} · S${latestEpisodes.seasonNumber}: ${episodes.watched} of ${episodes.total} aired episodes watched`
    : seasonLabel;
}
