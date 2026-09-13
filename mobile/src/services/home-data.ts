import type {
  RecentlyViewedItem,
  RecentlyViewedLoadResult,
} from './recently-viewed-rules.ts';
import type { WatchlistItem } from './watchlist-rules.ts';

export type HomeCollection<T> =
  | { status: 'available'; items: T[] }
  | { status: 'unavailable' };

export type HomeData = {
  recentlyViewed: RecentlyViewedLoadResult;
  watchlist: HomeCollection<WatchlistItem>;
};

type HomeLoaders = {
  loadRecentlyViewed: () => Promise<RecentlyViewedLoadResult>;
  loadWatchlist: () => Promise<WatchlistItem[]>;
};

export async function loadHomeData(loaders: HomeLoaders): Promise<HomeData> {
  const [recentResult, watchlistResult] = await Promise.allSettled([
    loaders.loadRecentlyViewed(),
    loaders.loadWatchlist(),
  ]);

  return {
    recentlyViewed: recentResult.status === 'fulfilled'
      ? recentResult.value
      : { status: 'unavailable', reason: 'read-error' },
    watchlist: watchlistResult.status === 'fulfilled'
      ? { status: 'available', items: watchlistResult.value }
      : { status: 'unavailable' },
  };
}

export type { RecentlyViewedItem };
