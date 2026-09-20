// Server-only: never import this module into src/.
import { handleDetails as handleSharedDetails } from '../../shared/tmdb-api/details.mjs';
import { parseApiRequest } from '../../shared/tmdb-api/request.mjs';
import { fetchTmdbJson } from '../../shared/tmdb-api/tmdb.mjs';

const detailKinds = new Set([
  'movie-details',
  'tv-details',
  'season-details',
  'person-details',
]);

function emitLegacyLog(logger, endpoint, event, error = null) {
  const completed = event.status >= 200 && event.status < 300;
  logger?.info?.(completed ? 'TMDB request completed' : 'TMDB request failed', {
    endpoint,
    status: event.status || null,
    ...(error ? { error } : {}),
    durationMs: event.durationMs,
  });
}

export async function handleDetails({
  pathname,
  method,
  token,
  fetchImpl,
  send,
  logger = console,
  optionalTimeoutMs = 3000,
}) {
  const url = typeof pathname === 'string' && pathname.startsWith('/')
    ? `http://localhost${pathname}`
    : pathname;
  const parsed = parseApiRequest({ method, url });
  if (!parsed.ok) {
    if (parsed.status === 405) return send(parsed.status, parsed.body);
    return send(400, { error: 'Choose a valid movie or TV title.' });
  }
  if (method !== 'GET') return send(405, { error: 'Use GET.' });
  if (!detailKinds.has(parsed.route.kind)) {
    return send(400, { error: 'Choose a valid movie or TV title.' });
  }

  const result = await handleSharedDetails(parsed.route, {
    token,
    optionalTimeoutMs,
    fetchTmdbJson: (options) => {
      let transportError = null;
      return fetchTmdbJson({
        ...options,
        fetchImpl: async (...args) => {
          try {
            return await fetchImpl(...args);
          } catch (error) {
            transportError = error instanceof Error ? error.name : 'UnknownError';
            throw error;
          }
        },
        log: (event) => emitLegacyLog(logger, options.endpoint, event, transportError),
      });
    },
  });
  return send(result.status, result.body);
}
