import type {
  RecentlyViewedItem,
  RecentlyViewedLoadResult,
} from './recently-viewed-rules.ts';
import type { MovieProgressLoadResult } from './movie-progress-rules.ts';
import type { WatchlistItem } from './watchlist-rules.ts';
import type { ProgressLoadResult } from './tv-progress-rules.ts';
import type { ScheduleLoadResult } from './tv-schedule-rules.ts';

export type HomeCollection<T> =
  | { status: 'available'; items: T[] }
  | { status: 'unavailable' };

export type HomeData = {
  recentlyViewed: RecentlyViewedLoadResult;
  watchlist: HomeCollection<WatchlistItem>;
  movieProgress: MovieProgressLoadResult;
  tvProgress: ProgressLoadResult;
  tvSchedules: ScheduleLoadResult;
};

type HomeLoaders = {
  loadRecentlyViewed: () => Promise<RecentlyViewedLoadResult>;
  loadWatchlist: () => Promise<WatchlistItem[]>;
  loadMovieProgress: () => Promise<MovieProgressLoadResult>;
  loadTvProgress: () => Promise<ProgressLoadResult>;
  loadTvSchedules: () => Promise<ScheduleLoadResult>;
};

export async function loadHomeData(loaders: HomeLoaders): Promise<HomeData> {
  const [recentResult, watchlistResult, movieResult, tvResult, scheduleResult] = await Promise.allSettled([
    loaders.loadRecentlyViewed(),
    loaders.loadWatchlist(),
    loaders.loadMovieProgress(),
    loaders.loadTvProgress(),
    loaders.loadTvSchedules(),
  ]);

  return {
    tvSchedules: scheduleResult.status === 'fulfilled' ? scheduleResult.value : { status: 'unavailable' },
    tvProgress: tvResult.status === 'fulfilled'
      ? tvResult.value
      : { status: 'unavailable', reason: 'read-error' },
    recentlyViewed: recentResult.status === 'fulfilled'
      ? recentResult.value
      : { status: 'unavailable', reason: 'read-error' },
    watchlist: watchlistResult.status === 'fulfilled'
      ? { status: 'available', items: watchlistResult.value }
      : { status: 'unavailable' },
    movieProgress: movieResult.status === 'fulfilled'
      ? movieResult.value
      : { status: 'unavailable', reason: 'read-error' },
  };
}

export type { RecentlyViewedItem };
