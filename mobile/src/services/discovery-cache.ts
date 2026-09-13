import type { RecentlyViewedSnapshot } from './recently-viewed-rules.ts';

export type DiscoveryData = { movies: RecentlyViewedSnapshot[]; tv: RecentlyViewedSnapshot[] };
export type DiscoveryResult = DiscoveryData & { stale: boolean };

function parseDiscovery(value: unknown): DiscoveryData {
  if (!value || typeof value !== 'object') throw new Error('Invalid discovery response.');
  const data = value as Record<string, unknown>;
  for (const [key, mediaType] of [['movies', 'Movie'], ['tv', 'TV']]) {
    const list = data[key];
    if (!Array.isArray(list) || list.length > 20 || list.some((item) => !item
      || !Number.isSafeInteger(item.id) || item.id <= 0 || item.mediaType !== mediaType
      || typeof item.title !== 'string' || !item.title.trim()
      || (item.year !== null && typeof item.year !== 'string')
      || (item.posterUrl !== null && (typeof item.posterUrl !== 'string'
        || !/^https:\/\/image\.tmdb\.org\/t\/p\/w500\/[\w.-]+$/.test(item.posterUrl))))) {
      throw new Error('Invalid discovery response.');
    }
  }
  return data as DiscoveryData;
}

export function createDiscoveryCache(fetchData: () => Promise<unknown>, now = Date.now) {
  let cached: DiscoveryResult | null = null;
  let expiresAt = 0;
  let pending: Promise<DiscoveryResult> | null = null;
  return {
    load(force = false): Promise<DiscoveryResult> {
      if (pending) return pending;
      if (!force && cached && now() < expiresAt) return Promise.resolve(cached);
      pending = Promise.resolve().then(fetchData).then((value) => {
        cached = { ...parseDiscovery(value), stale: false };
        expiresAt = now() + 30 * 60 * 1000;
        return cached;
      }).catch((error: unknown) => {
        if (!cached) throw error;
        cached = { ...cached, stale: true };
        expiresAt = now() + 60 * 1000;
        return cached;
      }).finally(() => { pending = null; });
      return pending;
    },
  };
}
