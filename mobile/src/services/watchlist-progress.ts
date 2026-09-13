import {
  calculateEpisodeProgress,
  calculateTvProgress,
  findTvProgress,
  type ProgressLoadResult,
} from './tv-progress-rules.ts';
import type { WatchlistItem } from './watchlist-rules.ts';

type LocalLoaders = {
  loadWatchlist: () => Promise<WatchlistItem[]>;
  loadProgress: () => Promise<ProgressLoadResult>;
};

export async function loadWatchlistProgressData(loaders: LocalLoaders) {
  const [items, progress] = await Promise.all([
    loaders.loadWatchlist(),
    loaders.loadProgress(),
  ]);
  return { items, progress };
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
