// Server-only. Cache public successful results, never credentials or upstream errors.
import { handleDiscovery } from '../../shared/tmdb-api/discovery.mjs';
import { fetchTmdbJson } from '../../shared/tmdb-api/tmdb.mjs';

const CACHE_TTL_MS = 30 * 60 * 1000;
const DISCOVERY_ROUTE = Object.freeze({ kind: 'discovery', cacheKey: '/discovery', cost: 2 });

export function createMemoryCache({ now = Date.now } = {}) {
  let cached = null;
  let expiresAt = 0;
  let pending = null;

  return {
    async getOrLoad(load) {
      if (cached && now() < expiresAt) return { status: 200, body: cached };
      pending ??= load().then((result) => {
        if (result.status === 200) {
          cached = result.body;
          expiresAt = now() + CACHE_TTL_MS;
        }
        return result;
      }).finally(() => { pending = null; });
      return pending;
    },
  };
}

export function createDiscoveryHandler({ token, fetchImpl = fetch, now = Date.now }) {
  const cache = createMemoryCache({ now });
  return async ({ method, send }) => {
    if (method !== 'GET') return send(405, { error: 'Use GET.' });
    if (!token) return send(503, { error: 'Discovery is not configured yet.' });

    const result = await cache.getOrLoad(() => handleDiscovery(DISCOVERY_ROUTE, {
      token,
      fetchTmdbJson: (options) => fetchTmdbJson({ ...options, fetchImpl }),
    }));
    return send(result.status, result.body);
  };
}
