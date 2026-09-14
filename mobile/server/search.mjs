// Server-only: never import this module into src/.
import { handleDetails } from './details.mjs';
import { createDiscoveryHandler } from './discovery.mjs';

export function createSearchHandler({
  token,
  fetchImpl = fetch,
  logger = console,
  detailsOptionalTimeoutMs,
}) {
  const handleDiscovery = createDiscoveryHandler({ token, fetchImpl });
  return async (request, response) => {
    const send = (status, body) => {
      response.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        // Local development supports the Expo web preview as well as iPhone.
        'Access-Control-Allow-Origin': '*',
      });
      response.end(JSON.stringify(body));
    };
    try {
      const incoming = new URL(request.url, 'http://localhost');
      if (incoming.pathname === '/discovery') return await handleDiscovery({ method: request.method, send });
      if (incoming.pathname.startsWith('/details/')) {
        return await handleDetails({
          pathname: incoming.pathname,
          method: request.method,
          token,
          fetchImpl,
          send,
          logger,
          optionalTimeoutMs: detailsOptionalTimeoutMs,
        });
      }
      if (incoming.pathname !== '/search') return send(404, { error: 'Not found.' });
      if (request.method !== 'GET') return send(405, { error: 'Use GET.' });
      const query = incoming.searchParams.get('query')?.trim();
      if (!query || query.length > 100) return send(400, { error: 'Enter a title of 1–100 characters.' });
      if (!token) return send(503, { error: 'Search is not configured yet.' });

      const url = new URL('https://api.themoviedb.org/3/search/multi');
      url.search = new URLSearchParams({ query, include_adult: 'false', page: '1' }).toString();
      const upstream = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      if (!upstream.ok) {
        return send(upstream.status === 429 ? 429 : 502, {
          error: upstream.status === 429 ? 'Please wait a moment before searching again.' : 'Search is temporarily unavailable. Please try again.',
        });
      }
      const data = await upstream.json();
      if (!Array.isArray(data.results)) throw new Error('Invalid response');
      const results = data.results
        .filter((item) => item && Number.isInteger(item.id) && ['movie', 'tv'].includes(item.media_type))
        .map((item) => {
          const movie = item.media_type === 'movie';
          const date = movie ? item.release_date : item.first_air_date;
          const title = movie ? item.title : item.name;
          return {
            id: `${item.media_type}-${item.id}`,
            title: typeof title === 'string' && title.trim() ? title : 'Untitled',
            year: typeof date === 'string' && /^\d{4}-/.test(date) ? date.slice(0, 4) : null,
            mediaType: movie ? 'Movie' : 'TV',
            posterUrl: typeof item.poster_path === 'string' && /^\/[\w.-]+$/.test(item.poster_path)
              ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
          };
        });
      send(200, { results });
    } catch {
      send(502, { error: 'Could not reach the search service. Please try again.' });
    }
  };
}
