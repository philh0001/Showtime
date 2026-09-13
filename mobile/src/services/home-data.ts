import type {
  RecentlyViewedItem,
  RecentlyViewedLoadResult,
} from './recently-viewed-rules.ts';
import type { MovieProgressLoadResult } from './movie-progress-rules.ts';
import type { WatchlistItem } from './watchlist-rules.ts';

export type HomeCollection<T> =
  | { status: 'available'; items: T[] }
  | { status: 'unavailable' };

export type HomeData = {
  recentlyViewed: RecentlyViewedLoadResult;
  watchlist: HomeCollection<WatchlistItem>;
  movieProgress: MovieProgressLoadResult;
};

type HomeLoaders = {
  loadRecentlyViewed: () => Promise<RecentlyViewedLoadResult>;
  loadWatchlist: () => Promise<WatchlistItem[]>;
  loadMovieProgress: () => Promise<MovieProgressLoadResult>;
};

export async function loadHomeData(loaders: HomeLoaders): Promise<HomeData> {
  const [recentResult, watchlistResult, movieResult] = await Promise.allSettled([
    loaders.loadRecentlyViewed(),
    loaders.loadWatchlist(),
    loaders.loadMovieProgress(),
  ]);

  return {
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
