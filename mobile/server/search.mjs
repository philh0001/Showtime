// Server-only: never import this module into src/.
import { parseApiRequest } from '../../worker/src/api/request.mjs';
import { handleSearch } from '../../worker/src/api/search.mjs';
import { fetchTmdbJson } from '../../worker/src/api/tmdb.mjs';
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
      const rawUrl = typeof request.url === 'string' && request.url.startsWith('/')
        ? `http://localhost${request.url}`
        : request.url;
      const incoming = new URL(rawUrl);
      if (incoming.pathname === '/discovery') return await handleDiscovery({ method: request.method, send });
      if (incoming.pathname.startsWith('/details/')) {
        return await handleDetails({
          pathname: rawUrl,
          method: request.method,
          token,
          fetchImpl,
          send,
          logger,
          optionalTimeoutMs: detailsOptionalTimeoutMs,
        });
      }

      const parsed = parseApiRequest({ method: request.method, url: rawUrl });
      if (!parsed.ok) return send(parsed.status, parsed.body);
      if (parsed.route.kind !== 'search') return send(404, { error: 'Not found.' });

      const result = await handleSearch(parsed.route, {
        token,
        fetchTmdbJson: (options) => fetchTmdbJson({
          ...options,
          fetchImpl,
          log: (event) => logger.info?.(event),
        }),
      });
      send(result.status, result.body);
    } catch {
      send(502, { error: 'Could not reach the search service. Please try again.' });
    }
  };
}
