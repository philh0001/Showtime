// This file runs only on the computer/server, never in the mobile bundle.
const imageUrl = (path, size) => typeof path === 'string' && /^\/[\w.-]+$/.test(path)
  ? `https://image.tmdb.org/t/p/${size}${path}` : null;
const textOrNull = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const dateOrNull = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day ? value : null;
};

function mapPerson(data, id) {
  if (!data || data.id !== id || !textOrNull(data.name)) return null;
  const knownFor = Array.isArray(data.known_for)
    ? data.known_for.map((item) => textOrNull(item?.title ?? item?.name)).filter(Boolean).slice(0, 5)
    : [];
  return {
    id,
    name: textOrNull(data.name),
    biography: textOrNull(data.biography),
    birthday: dateOrNull(data.birthday),
    knownFor,
  };
}

function nextEpisodeOrNull(value) {
  if (!value || !Number.isSafeInteger(value.id) || value.id <= 0
    || !Number.isInteger(value.season_number) || value.season_number < 0
    || !Number.isInteger(value.episode_number) || value.episode_number <= 0) return null;
  const airDate = dateOrNull(value.air_date);
  return airDate ? {
    id: value.id,
    name: textOrNull(value.name),
    seasonNumber: value.season_number,
    episodeNumber: value.episode_number,
    airDate,
  } : null;
}

function episodeOrNull(value, seasonNumber) {
  if (!value || !Number.isSafeInteger(value.id) || value.id <= 0
    || value.season_number !== seasonNumber
    || !Number.isInteger(value.episode_number) || value.episode_number <= 0) return null;
  return {
    id: value.id,
    name: textOrNull(value.name),
    seasonNumber,
    episodeNumber: value.episode_number,
    airDate: dateOrNull(value.air_date),
  };
}

function mapExtras(data) {
  const cast = new Map();
  for (const person of Array.isArray(data.credits?.cast) ? data.credits.cast : []) {
    if (!person || !Number.isSafeInteger(person.id) || person.id <= 0 || !textOrNull(person.name) || cast.has(person.id)) continue;
    cast.set(person.id, { id: person.id, name: textOrNull(person.name), character: textOrNull(person.character), profileUrl: imageUrl(person.profile_path, 'w185') });
    if (cast.size === 12) break;
  }

  const crew = new Map();
  for (const person of Array.isArray(data.credits?.crew) ? data.credits.crew : []) {
    if (!person || !Number.isSafeInteger(person.id) || person.id <= 0 || !textOrNull(person.name)
      || !['Director', 'Writer', 'Screenplay', 'Creator', 'Executive Producer'].includes(person.job)) continue;
    crew.set(`${person.id}:${person.job}`, { id: person.id, name: textOrNull(person.name), job: person.job });
    if (crew.size === 8) break;
  }
  const video = (Array.isArray(data.videos?.results) ? data.videos.results : []).find((item) =>
    item?.site === 'YouTube' && item.type === 'Trailer' && item.official === true
    && typeof item.key === 'string' && /^[A-Za-z0-9_-]{11}$/.test(item.key));
  return {
    cast: [...cast.values()], crew: [...crew.values()],
    trailer: video ? { name: textOrNull(video.name) ?? 'Official trailer', url: `https://www.youtube.com/watch?v=${video.key}` } : null,
  };
}

const providerGroups = ['flatrate', 'free', 'ads', 'rent', 'buy'];
function normalizeProviderName(value) {
  const name = value.trim();
  const lower = name.toLowerCase();
  if (lower.includes('amazon prime') || lower === 'prime video' || lower.includes('amazon video')) {
    return 'Amazon Prime Video';
  }
  if (lower.includes('paramount')) return 'Paramount+';
  if (lower.includes('netflix')) return 'Netflix';
  if (lower.includes('disney')) return 'Disney+';
  if (lower.includes('apple tv')) return 'Apple TV';
  if (lower.includes('max')) return 'Max';
  return name;
}

function mapWatchProviders(data) {
  const region = data?.results?.GB;
  if (!region || typeof region !== 'object') {
    return { status: 'unavailable', region: 'GB', link: null, providers: [] };
  }
  const providers = [];
  const seen = new Set();
  const seenProviderIds = new Set();
  for (const group of providerGroups) {
    for (const provider of Array.isArray(region[group]) ? region[group] : []) {
      if (!provider || !Number.isSafeInteger(provider.provider_id) || provider.provider_id <= 0
        || !textOrNull(provider.provider_name) || seenProviderIds.has(provider.provider_id)) continue;
      const offers = group === 'flatrate' || group === 'free' || group === 'ads' ? 'stream' : group;
      const name = normalizeProviderName(provider.provider_name);
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      providers.push({
        id: provider.provider_id,
        name,
        logoUrl: imageUrl(provider.logo_path, 'w92'),
        offers,
      });
      seen.add(key);
      seenProviderIds.add(provider.provider_id);
      if (providers.length === 20) break;
    }
    if (providers.length === 20) break;
  }
  const link = typeof region.link === 'string' && /^https:\/\/www\.themoviedb\.org\/.+/.test(region.link)
    ? region.link : null;
  return { status: providers.length ? 'available' : 'none', region: 'GB', link, providers };
}

function logTmdbResult(logger, message, { endpoint, status = null, error = null, startedAt }) {
  logger?.info?.(message, {
    endpoint,
    status,
    ...(error ? { error: error instanceof Error ? error.name : 'UnknownError' } : {}),
    durationMs: Date.now() - startedAt,
  });
}

async function fetchTmdb({ endpoint, token, fetchImpl, logger, timeoutMs }) {
  const startedAt = Date.now();
  try {
    const response = await fetchImpl(`https://api.themoviedb.org${endpoint}`, {
      headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    logTmdbResult(logger, response.ok ? 'TMDB request completed' : 'TMDB request failed', {
      endpoint,
      status: response.status,
      startedAt,
    });
    return response;
  } catch (error) {
    logTmdbResult(logger, 'TMDB request failed', { endpoint, error, startedAt });
    throw error;
  }
}

async function loadOptionalJson({ endpoint, token, fetchImpl, logger, timeoutMs }) {
  try {
    const response = await fetchTmdb({ endpoint, token, fetchImpl, logger, timeoutMs });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

async function loadExtras({ mediaType, id, token, fetchImpl, logger, timeoutMs }) {
  const [credits, videos] = await Promise.all([
    loadOptionalJson({ endpoint: `/3/${mediaType}/${id}/credits`, token, fetchImpl, logger, timeoutMs }),
    loadOptionalJson({ endpoint: `/3/${mediaType}/${id}/videos`, token, fetchImpl, logger, timeoutMs }),
  ]);
  return mapExtras({ credits, videos });
}

async function loadWatchProviders({ mediaType, id, token, fetchImpl, logger, timeoutMs }) {
  const data = await loadOptionalJson({
    endpoint: `/3/${mediaType}/${id}/watch/providers?watch_region=GB`,
    token,
    fetchImpl,
    logger,
    timeoutMs,
  });
  return mapWatchProviders(data);
}

async function loadLatestSeason({ tvId, season, token, fetchImpl, logger, timeoutMs }) {
  if (!season) return null;
  const data = await loadOptionalJson({
    endpoint: `/3/tv/${tvId}/season/${season.seasonNumber}`,
    token,
    fetchImpl,
    logger,
    timeoutMs,
  });
  if (!data || data.id !== season.id || data.season_number !== season.seasonNumber
    || !Array.isArray(data.episodes)) return null;
  const episodes = data.episodes
    .map((episode) => episodeOrNull(episode, season.seasonNumber))
    .filter(Boolean)
    .sort((a, b) => a.episodeNumber - b.episodeNumber || a.id - b.id);
  return {
    seasonNumber: season.seasonNumber,
    name: textOrNull(data.name) ?? season.name,
    episodes,
  };
}

async function loadSeason({ tvId, seasonNumber, token, fetchImpl, logger, timeoutMs }) {
  const data = await fetchTmdb({
    endpoint: `/3/tv/${tvId}/season/${seasonNumber}`,
    token,
    fetchImpl,
    logger,
    timeoutMs,
  });
  if (!data.ok) {
    if (data.status === 404) return { status: 404 };
    if (data.status === 429) return { status: 429 };
    return { status: 502 };
  }
  const value = await data.json();
  if (!Number.isSafeInteger(value.id) || value.id <= 0
    || value.season_number !== seasonNumber
    || !Array.isArray(value.episodes)) return { status: 502 };
  return {
    status: 200,
    season: {
      seasonNumber,
      name: textOrNull(value.name) ?? `Season ${seasonNumber}`,
      episodes: value.episodes
        .map((episode) => episodeOrNull(episode, seasonNumber))
        .filter(Boolean)
        .sort((a, b) => a.episodeNumber - b.episodeNumber || a.id - b.id),
    },
  };
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
  if (method !== 'GET') return send(405, { error: 'Use GET.' });
  const personMatch = /^\/details\/person\/([1-9]\d*)$/.exec(pathname);
  if (personMatch) {
    if (!Number.isSafeInteger(Number(personMatch[1]))) return send(400, { error: 'Choose a valid person.' });
    if (!token) return send(503, { error: 'Details are not configured yet.' });
    const id = Number(personMatch[1]);
    try {
      const upstream = await fetchTmdb({
        endpoint: `/3/person/${id}`,
        token,
        fetchImpl,
        logger,
        timeoutMs: 10000,
      });
      if (upstream.status === 404) return send(404, { error: 'This person could not be found.' });
      if (upstream.status === 429) return send(429, { error: 'Please wait a moment and try again.' });
      if (!upstream.ok) return send(502, { error: 'Person details are temporarily unavailable.' });
      const person = mapPerson(await upstream.json(), id);
      if (!person) throw new Error('Invalid person response');
      return send(200, { person });
    } catch {
      return send(502, { error: 'Could not load person details. Please try again.' });
    }
  }
  const seasonMatch = /^\/details\/tv\/([1-9]\d*)\/season\/([1-9]\d*)$/.exec(pathname);
  if (seasonMatch && Number.isSafeInteger(Number(seasonMatch[1]))
    && Number.isSafeInteger(Number(seasonMatch[2]))) {
    if (!token) return send(503, { error: 'Details are not configured yet.' });
    try {
      const result = await loadSeason({
        tvId: Number(seasonMatch[1]),
        seasonNumber: Number(seasonMatch[2]),
        token,
        fetchImpl,
        logger,
        timeoutMs: 10000,
      });
      if (result.status !== 200) {
        return send(result.status, {
          error: result.status === 404 ? 'This season could not be found.'
            : result.status === 429 ? 'Please wait a moment and try again.'
              : 'Season details are temporarily unavailable.',
        });
      }
      return send(200, { season: result.season });
    } catch {
      return send(502, { error: 'Could not load season details. Please try again.' });
    }
  }
  const match = /^\/details\/(movie|tv)\/([1-9]\d*)$/.exec(pathname);
  if (!match || !Number.isSafeInteger(Number(match[2]))) {
    return send(400, { error: 'Choose a valid movie or TV title.' });
  }
  if (!token) return send(503, { error: 'Details are not configured yet.' });
  const [, mediaType, id] = match;

  try {
    const mainEndpoint = `/3/${mediaType}/${id}`;
    const upstream = await fetchTmdb({
      endpoint: mainEndpoint,
      token,
      fetchImpl,
      logger,
      timeoutMs: 10000,
    });
    if (!upstream.ok) {
      if (upstream.status === 404) return send(404, { error: 'This title could not be found.' });
      if (upstream.status === 429) return send(429, { error: 'Please wait a moment and try again.' });
      return send(502, { error: 'Details are temporarily unavailable.' });
    }
    const data = await upstream.json();
    if (!data || data.id !== Number(id)) throw new Error('Invalid detail response');
    const movie = mediaType === 'movie';
    const seasons = !movie && Array.isArray(data.seasons)
      ? data.seasons.filter((season) => season && Number.isSafeInteger(season.id)
        && Number.isInteger(season.season_number) && season.season_number >= 0)
        .map((season) => ({
          id: season.id,
          name: textOrNull(season.name) ?? (season.season_number === 0 ? 'Specials' : `Season ${season.season_number}`),
          seasonNumber: season.season_number,
          episodeCount: Number.isInteger(season.episode_count) && season.episode_count >= 0 ? season.episode_count : null,
          airDate: dateOrNull(season.air_date),
        })).sort((a, b) => a.seasonNumber - b.seasonNumber)
      : [];
    const latestSeasonSummary = [...seasons].reverse().find(
      (season) => season.seasonNumber > 0 && season.episodeCount !== 0,
    ) ?? null;
    const [extras, latestSeason, watchProviders] = await Promise.all([
      loadExtras({ mediaType, id, token, fetchImpl, logger, timeoutMs: optionalTimeoutMs }),
      movie ? null : loadLatestSeason({
        tvId: data.id,
        season: latestSeasonSummary,
        token,
        fetchImpl,
        logger,
        timeoutMs: optionalTimeoutMs,
      }),
      loadWatchProviders({ mediaType, id, token, fetchImpl, logger, timeoutMs: optionalTimeoutMs }),
    ]);
    send(200, { details: {
      ...extras,
      watchProviders,
      id: data.id,
      mediaType: movie ? 'Movie' : 'TV',
      title: textOrNull(movie ? data.title : data.name) ?? 'Untitled',
      overview: textOrNull(data.overview),
      releaseDate: dateOrNull(movie ? data.release_date : data.first_air_date),
      posterUrl: imageUrl(data.poster_path, 'w500'),
      backdropUrl: imageUrl(data.backdrop_path, 'w780'),
      rating: data.vote_count > 0 && Number.isFinite(data.vote_average)
        && data.vote_average >= 0 && data.vote_average <= 10 ? data.vote_average : null,
      genres: Array.isArray(data.genres) ? data.genres.map((genre) => textOrNull(genre?.name)).filter(Boolean) : [],
      seasons,
      nextEpisode: movie ? null : nextEpisodeOrNull(data.next_episode_to_air),
      latestSeason,
    } });
  } catch {
    // Do not forward TMDB bodies, credentials or raw network errors.
    send(502, { error: 'Could not load details. Please try again.' });
  }
}
