import {
  addRecentlyViewedItem,
  parseRecentlyViewed,
  type RecentlyViewedItem,
  type RecentlyViewedLoadResult,
  type RecentlyViewedSnapshot,
} from './recently-viewed-rules.ts';

export const RECENTLY_VIEWED_KEY = 'showtime.recently-viewed.v1';

type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export class RecentlyViewedUnavailableError extends Error {}

export function createRecentlyViewedStorage(
  storage: Storage,
  now = () => new Date().toISOString(),
) {
  async function load(): Promise<RecentlyViewedLoadResult> {
    try {
      return parseRecentlyViewed(await storage.getItem(RECENTLY_VIEWED_KEY));
    } catch {
      return { status: 'unavailable', reason: 'read-error' };
    }
  }

  async function record(snapshot: RecentlyViewedSnapshot): Promise<RecentlyViewedItem[]> {
    const loaded = await load();
    if (loaded.status === 'unavailable') {
      throw new RecentlyViewedUnavailableError('Recently Viewed is unavailable.');
    }
    const items = addRecentlyViewedItem(loaded.items, snapshot, now());
    await storage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(items));
    return items;
  }

  return { load, record };
}
