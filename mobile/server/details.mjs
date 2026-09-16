// Server-only: never import this module into src/.
import { handleDetails as handleSharedDetails } from '../../worker/src/api/details.mjs';
import { parseApiRequest } from '../../worker/src/api/request.mjs';
import { fetchTmdbJson } from '../../worker/src/api/tmdb.mjs';

const detailKinds = new Set([
  'movie-details',
  'tv-details',
  'season-details',
  'person-details',
]);

function emitLegacyLog(logger, endpoint, event) {
  const completed = event.status >= 200 && event.status < 300;
  logger?.info?.(completed ? 'TMDB request completed' : 'TMDB request failed', {
    endpoint,
    status: event.status || null,
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
  if (!parsed.ok) return send(parsed.status, parsed.body);
  if (method !== 'GET') return send(405, { error: 'Use GET.' });
  if (!detailKinds.has(parsed.route.kind)) {
    return send(400, { error: 'Choose a valid movie or TV title.' });
  }

  const result = await handleSharedDetails(parsed.route, {
    token,
    optionalTimeoutMs,
    fetchTmdbJson: (options) => fetchTmdbJson({
      ...options,
      fetchImpl,
      log: (event) => emitLegacyLog(logger, options.endpoint, event),
    }),
  });
  return send(result.status, result.body);
}
