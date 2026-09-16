import type { HomeCollection } from './home-data.ts';
import type { MovieProgressLoadResult } from './movie-progress-rules.ts';
import type { RecentlyViewedItem, RecentlyViewedSnapshot } from './recently-viewed-rules.ts';
import { calculateEpisodeProgress, calculateTvProgress, type ProgressLoadResult, type TvProgress } from './tv-progress-rules.ts';
import type { WatchlistItem } from './watchlist-rules.ts';
import type { ViewingActivity } from './viewing-activity-rules.ts';

export type ViewingProgress = { watched: number; total: number; fraction: number };
export type ContinueWatchingItem = RecentlyViewedSnapshot & { progress: ViewingProgress };

function summarizeTv(record: TvProgress) {
  const seasons = calculateTvProgress(record);
  const detailed = record.episodeProgress.filter((item) => record.trackableSeasonNumbers.includes(item.seasonNumber));
  const episodesWatched = detailed.reduce((sum, item) => sum + calculateEpisodeProgress(item).watched, 0);
  // A partially watched season contributes a fraction; completed seasons count once.
  const partial = detailed.reduce((sum, item) => {
    if (item.knownEpisodeNumbers.length === 0) return sum;
    const watched = new Set(item.watchedEpisodeNumbers);
    const aired = new Set(item.trackableEpisodeNumbers);
    const count = item.knownEpisodeNumbers.filter((number) => watched.has(number) && aired.has(number)).length;
    return sum + (count < item.knownEpisodeNumbers.length ? count / item.knownEpisodeNumbers.length : 0);
  }, 0);
  return {
    ...seasons,
    episodesWatched,
    started: seasons.watched > 0 || episodesWatched > 0,
    fraction: seasons.total > 0 ? Math.min(1, (seasons.watched + partial) / seasons.total) : 0,
  };
}

export function getContinueWatching(
  watchlist: WatchlistItem[],
  recentlyViewed: RecentlyViewedItem[],
  progress: ProgressLoadResult,
  savedSnapshots: RecentlyViewedSnapshot[] = [],
): ContinueWatchingItem[] {
  if (progress.status === 'unavailable') return [];
  const metadata = new Map<number, RecentlyViewedSnapshot>();
  for (const item of [...recentlyViewed, ...watchlist, ...savedSnapshots]) {
    if (item.mediaType === 'TV' && !metadata.has(item.id)) metadata.set(item.id, item);
  }
  const records = new Map(progress.records.map((record) => [record.tvId, record]));
  const items: ContinueWatchingItem[] = [];
  for (const item of metadata.values()) {
    const record = records.get(item.id);
    if (!record) continue;
    const summary = summarizeTv(record);
    if (summary.started && summary.watched < summary.total) {
      items.push({ ...item, progress: { watched: summary.watched, total: summary.total, fraction: summary.fraction } });
    }
  }
  return items;
}

export function getViewingStats(
  watchlist: HomeCollection<WatchlistItem>,
  movies: MovieProgressLoadResult,
  tv: ProgressLoadResult,
  recentlyViewed?: { status: 'available'; items: unknown[] } | { status: 'unavailable' },
  activity?: { status: 'available'; records: ViewingActivity[] } | { status: 'unavailable' },
) {
  const summaries = tv.status === 'available' ? tv.records.map(summarizeTv) : null;
  const stats = {
    watchlist: watchlist.status === 'available' ? watchlist.items.length : null,
    moviesWatched: movies.status === 'available' ? movies.records.length : null,
    seasonsWatched: summaries?.reduce((sum, item) => sum + item.watched, 0) ?? null,
    showsTracked: summaries?.filter((item) => item.started).length ?? null,
    outstandingShows: summaries?.filter((item) => item.started && item.watched < item.total).length ?? null,
    episodesWatched: summaries?.reduce((sum, item) => sum + item.episodesWatched, 0) ?? null,
  };
  return {
    ...stats,
    ...(recentlyViewed ? { recentlyViewed: recentlyViewed.status === 'available' ? recentlyViewed.items.length : null } : {}),
    ...(activity ? { activityEntries: activity.status === 'available' ? activity.records.length : null } : {}),
  };
}

export function getActivityStats(records: ViewingActivity[]) {
  const watched = records.filter((event) => event.action.watched);
  const watchedMovies = new Set(watched
    .filter((event) => event.title.mediaType === 'Movie')
    .map((event) => event.title.id));
  return {
    entries: records.length,
    watchedEntries: watched.length,
    movies: watchedMovies.size,
    tv: watched.filter((event) => event.title.mediaType === 'TV').length,
    latest: records[0]?.happenedAt ?? null,
  };
}
