export const RECENTLY_VIEWED_LIMIT = 20;

export type RecentlyViewedSnapshot = {
  id: number;
  mediaType: 'Movie' | 'TV';
  title: string;
  year: string | null;
  posterUrl: string | null;
};

export type RecentlyViewedItem = RecentlyViewedSnapshot & {
  viewedAt: string;
};

export type RecentlyViewedLoadResult =
  | { status: 'available'; items: RecentlyViewedItem[] }
  | { status: 'unavailable'; reason: 'malformed' | 'read-error' };

function itemKey(item: Pick<RecentlyViewedItem, 'id' | 'mediaType'>) {
  return `${item.mediaType}:${item.id}`;
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function normalizeItem(value: unknown): RecentlyViewedItem | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (!Number.isSafeInteger(item.id) || Number(item.id) <= 0
    || (item.mediaType !== 'Movie' && item.mediaType !== 'TV')
    || typeof item.title !== 'string' || !item.title.trim()
    || (item.year !== null && typeof item.year !== 'string')
    || (item.posterUrl !== null && typeof item.posterUrl !== 'string')
    || !isIsoTimestamp(item.viewedAt)) return null;
  return {
    id: Number(item.id),
    mediaType: item.mediaType,
    title: item.title.trim(),
    year: item.year,
    posterUrl: item.posterUrl,
    viewedAt: item.viewedAt,
  };
}

function normalizeItems(values: unknown[]) {
  const newest = new Map<string, RecentlyViewedItem>();
  for (const value of values) {
    const item = normalizeItem(value);
    if (!item) continue;
    const key = itemKey(item);
    const current = newest.get(key);
    if (!current || item.viewedAt > current.viewedAt) newest.set(key, item);
  }
  return [...newest.values()]
    .sort((a, b) => b.viewedAt.localeCompare(a.viewedAt)
      || a.mediaType.localeCompare(b.mediaType)
      || a.id - b.id)
    .slice(0, RECENTLY_VIEWED_LIMIT);
}

export function parseRecentlyViewed(stored: string | null): RecentlyViewedLoadResult {
  if (stored === null) return { status: 'available', items: [] };
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? { status: 'available', items: normalizeItems(parsed) }
      : { status: 'unavailable', reason: 'malformed' };
  } catch {
    return { status: 'unavailable', reason: 'malformed' };
  }
}

export function addRecentlyViewedItem(
  items: RecentlyViewedItem[],
  snapshot: RecentlyViewedSnapshot,
  viewedAt: string,
) {
  return normalizeItems([{ ...snapshot, viewedAt }, ...items]);
}
