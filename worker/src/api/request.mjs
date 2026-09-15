const MAX_URL_BYTES = 2048;
const MAX_SEARCH_LENGTH = 100;
const POSITIVE_INTEGER = /^[1-9]\d*$/;

const failure = (status, error) => ({ ok: false, status, body: { error } });

function success(route, method) {
  const parsedRoute = method === 'OPTIONS'
    ? { kind: 'options', cacheKey: route.cacheKey, cost: 0 }
    : route;
  return { ok: true, route: Object.freeze(parsedRoute) };
}

function positiveSafeInteger(value) {
  if (!POSITIVE_INTEGER.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function hasNoncanonicalDotSegment(url) {
  const match = /^[a-z][a-z\d+.-]*:\/\/[^/?#]*([^?#]*)/i.exec(url);
  if (!match) return false;
  if (match[1].includes('\\')) return true;
  return match[1].split('/').some((segment) => {
    const dots = segment.replaceAll(/%2e/gi, '.');
    return dots === '.' || dots === '..';
  });
}

function noQueryParameters(incoming) {
  return [...incoming.searchParams].length === 0;
}

function searchRoute(incoming) {
  const queries = incoming.searchParams.getAll('query');
  if ([...incoming.searchParams].length !== 1 || queries.length !== 1) {
    return failure(400, 'Enter a title of 1–100 characters.');
  }
  const query = queries[0].trim();
  if (query.length < 1 || query.length > MAX_SEARCH_LENGTH) {
    return failure(400, 'Enter a title of 1–100 characters.');
  }
  return {
    kind: 'search',
    query,
    cacheKey: `/search?${new URLSearchParams({ query })}`,
    cost: 1,
  };
}

function detailsRoute(pathname) {
  const season = /^\/details\/tv\/([^/]*)\/season\/([^/]*)$/.exec(pathname);
  if (season) {
    const id = positiveSafeInteger(season[1]);
    const seasonNumber = positiveSafeInteger(season[2]);
    if (id === null || seasonNumber === null) {
      return failure(400, 'Choose a valid TV season.');
    }
    return {
      kind: 'season-details',
      id,
      seasonNumber,
      cacheKey: `/details/tv/${id}/season/${seasonNumber}`,
      cost: 1,
    };
  }

  const details = /^\/details\/(movie|tv|person)\/([^/]*)$/.exec(pathname);
  if (!details) return null;
  const id = positiveSafeInteger(details[2]);
  if (id === null) return failure(400, 'Choose a valid title or person.');

  const kind = `${details[1]}-details`;
  const cost = details[1] === 'movie' ? 4 : details[1] === 'tv' ? 5 : 1;
  return {
    kind,
    id,
    cacheKey: `/details/${details[1]}/${id}`,
    cost,
  };
}

export function parseApiRequest({ method, url }) {
  if (new TextEncoder().encode(url).byteLength > MAX_URL_BYTES) {
    return failure(414, 'Request URL is too long.');
  }
  if (url.split(/[?#]/, 1)[0].includes('\\')) return failure(404, 'Not found.');

  let incoming;
  try {
    incoming = new URL(url);
  } catch {
    return failure(400, 'Invalid request URL.');
  }

  if (!['GET', 'OPTIONS'].includes(method)) {
    return { ...failure(405, 'Use GET.'), allow: 'GET, OPTIONS' };
  }
  if (hasNoncanonicalDotSegment(url)) return failure(404, 'Not found.');

  let route;
  if (incoming.pathname === '/search') {
    route = searchRoute(incoming);
  } else if (incoming.pathname === '/discovery') {
    route = noQueryParameters(incoming)
      ? { kind: 'discovery', cacheKey: '/discovery', cost: 2 }
      : failure(400, 'Query parameters are not allowed.');
  } else {
    route = detailsRoute(incoming.pathname);
    if (route && route.ok !== false && !noQueryParameters(incoming)) {
      route = failure(400, 'Query parameters are not allowed.');
    }
  }

  if (!route) return failure(404, 'Not found.');
  if (route.ok === false) return route;
  return success(route, method);
}
