export type WatchlistItem = {
  id: number;
  mediaType: 'Movie' | 'TV';
  title: string;
  year: string | null;
  posterUrl: string | null;
};

function matches(item: WatchlistItem, id: number, mediaType: WatchlistItem['mediaType']) {
  return item.id === id && item.mediaType === mediaType;
}

function isWatchlistItem(value: unknown): value is WatchlistItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return Number.isSafeInteger(item.id) && Number(item.id) > 0
    && (item.mediaType === 'Movie' || item.mediaType === 'TV')
    && typeof item.title === 'string' && item.title.trim().length > 0
    && (item.year === null || typeof item.year === 'string')
    && (item.posterUrl === null || typeof item.posterUrl === 'string');
}

export function isInWatchlist(
  watchlist: WatchlistItem[],
  id: number,
  mediaType: WatchlistItem['mediaType'],
) {
  return watchlist.some((item) => matches(item, id, mediaType));
}

export function addWatchlistItem(watchlist: WatchlistItem[], item: WatchlistItem) {
  return [item, ...watchlist.filter((saved) => !matches(saved, item.id, item.mediaType))];
}

export function removeWatchlistItem(
  watchlist: WatchlistItem[],
  id: number,
  mediaType: WatchlistItem['mediaType'],
) {
  return watchlist.filter((item) => !matches(item, id, mediaType));
}

export function parseWatchlist(stored: string | null): WatchlistItem[] {
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    const watchlist: WatchlistItem[] = [];
    for (const item of parsed) {
      if (isWatchlistItem(item) && !isInWatchlist(watchlist, item.id, item.mediaType)) {
        watchlist.push(item);
      }
    }
    return watchlist;
  } catch {
    return [];
  }
}
