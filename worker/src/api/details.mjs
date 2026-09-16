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

function mapExtras({ credits, videos }) {
  const cast = new Map();
  for (const person of Array.isArray(credits?.cast) ? credits.cast : []) {
    if (!person || !Number.isSafeInteger(person.id) || person.id <= 0
      || !textOrNull(person.name) || cast.has(person.id)) continue;
    cast.set(person.id, {
      id: person.id,
      name: textOrNull(person.name),
      character: textOrNull(person.character),
      profileUrl: imageUrl(person.profile_path, 'w185'),
    });
    if (cast.size === 12) break;
  }

  const crew = new Map();
  for (const person of Array.isArray(credits?.crew) ? credits.crew : []) {
    if (!person || !Number.isSafeInteger(person.id) || person.id <= 0
      || !textOrNull(person.name)
      || !['Director', 'Writer', 'Screenplay', 'Creator', 'Executive Producer'].includes(person.job)) continue;
    crew.set(`${person.id}:${person.job}`, {
      id: person.id,
      name: textOrNull(person.name),
      job: person.job,
    });
    if (crew.size === 8) break;
  }

  const video = (Array.isArray(videos?.results) ? videos.results : []).find((item) =>
    item?.site === 'YouTube' && item.type === 'Trailer' && item.official === true
    && typeof item.key === 'string' && /^[A-Za-z0-9_-]{11}$/.test(item.key));
  return {
    cast: [...cast.values()],
    crew: [...crew.values()],
    trailer: video ? {
      name: textOrNull(video.name) ?? 'Official trailer',
      url: `https://www.youtube.com/watch?v=${video.key}`,
    } : null,
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

function unavailableProviders() {
  return { status: 'unavailable', region: 'GB', link: null, providers: [] };
}

function mapWatchProviders(data) {
  const region = data?.results?.GB;
  if (!region || typeof region !== 'object') return unavailableProviders();

  const providers = [];
  const seen = new Set();
  const seenProviderIds = new Set();
  for (const group of providerGroups) {
    for (const provider of Array.isArray(region[group]) ? region[group] : []) {
      if (!provider || !Number.isSafeInteger(provider.provider_id) || provider.provider_id <= 0
        || !textOrNull(provider.provider_name) || seenProviderIds.has(provider.provider_id)) continue;
      const offers = ['flatrate', 'free', 'ads'].includes(group) ? 'stream' : group;
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
  const link = typeof region.link === 'string'
    && /^https:\/\/www\.themoviedb\.org\/.+/.test(region.link) ? region.link : null;
  return {
    status: providers.length ? 'available' : 'none',
    region: 'GB',
    link,
    providers,
  };
}

function requestOptions(route, deps, endpoint, timeoutMs) {
  return {
    endpoint,
    route: route.kind,
    token: deps.token,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
    ...(deps.log ? { log: deps.log } : {}),
  };
}

async function loadOptionalJson(route, deps, endpoint) {
  try {
    return await deps.fetchTmdbJson(requestOptions(route, deps, endpoint, deps.optionalTimeoutMs));
  } catch {
    return null;
  }
}

async function loadExtras(route, deps, mediaType, id) {
  const [credits, videos] = await Promise.all([
    loadOptionalJson(route, deps, `/3/${mediaType}/${id}/credits`),
    loadOptionalJson(route, deps, `/3/${mediaType}/${id}/videos`),
  ]);
  return mapExtras({ credits, videos });
}

async function loadWatchProviders(route, deps, mediaType, id) {
  const data = await loadOptionalJson(
    route,
    deps,
    `/3/${mediaType}/${id}/watch/providers?watch_region=GB`,
  );
  return data === null ? unavailableProviders() : mapWatchProviders(data);
}

async function loadLatestSeason(route, deps, tvId, season) {
  if (!season) return null;
  const data = await loadOptionalJson(
    route,
    deps,
    `/3/tv/${tvId}/season/${season.seasonNumber}`,
  );
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

function primaryError(error, subject) {
  if (error?.kind === 'not-found') {
    const noun = subject === 'title' ? 'title' : subject;
    return { status: 404, body: { error: `This ${noun} could not be found.` } };
  }
  if (error?.kind === 'throttled') {
    return { status: 429, body: { error: 'Please wait a moment and try again.' } };
  }
  if (error?.kind === 'upstream' && Number.isInteger(error.status) && error.status > 0) {
    const prefix = subject === 'title' ? 'Details' : `${subject[0].toUpperCase()}${subject.slice(1)} details`;
    return { status: 502, body: { error: `${prefix} are temporarily unavailable.` } };
  }
  const prefix = subject === 'title' ? 'details' : `${subject} details`;
  return { status: 502, body: { error: `Could not load ${prefix}. Please try again.` } };
}

async function loadPerson(route, deps) {
  try {
    const data = await deps.fetchTmdbJson(requestOptions(
      route,
      deps,
      `/3/person/${route.id}`,
    ));
    const person = mapPerson(data, route.id);
    if (!person) throw new TypeError('Invalid person response');
    return { status: 200, body: { person } };
  } catch (error) {
    return primaryError(error, 'person');
  }
}

async function loadSeason(route, deps) {
  try {
    const data = await deps.fetchTmdbJson(requestOptions(
      route,
      deps,
      `/3/tv/${route.id}/season/${route.seasonNumber}`,
    ));
    if (!Number.isSafeInteger(data?.id) || data.id <= 0
      || data.season_number !== route.seasonNumber
      || !Array.isArray(data.episodes)) throw new TypeError('Invalid season response');
    return {
      status: 200,
      body: {
        season: {
          seasonNumber: route.seasonNumber,
          name: textOrNull(data.name) ?? `Season ${route.seasonNumber}`,
          episodes: data.episodes
            .map((episode) => episodeOrNull(episode, route.seasonNumber))
            .filter(Boolean)
            .sort((a, b) => a.episodeNumber - b.episodeNumber || a.id - b.id),
        },
      },
    };
  } catch (error) {
    return primaryError(error, 'season');
  }
}

async function loadTitle(route, deps) {
  const movie = route.kind === 'movie-details';
  const mediaType = movie ? 'movie' : 'tv';
  try {
    const data = await deps.fetchTmdbJson(requestOptions(
      route,
      deps,
      `/3/${mediaType}/${route.id}`,
    ));
    if (!data || data.id !== route.id) throw new TypeError('Invalid detail response');

    const seasons = !movie && Array.isArray(data.seasons)
      ? data.seasons.filter((season) => season && Number.isSafeInteger(season.id)
        && Number.isInteger(season.season_number) && season.season_number >= 0)
        .map((season) => ({
          id: season.id,
          name: textOrNull(season.name)
            ?? (season.season_number === 0 ? 'Specials' : `Season ${season.season_number}`),
          seasonNumber: season.season_number,
          episodeCount: Number.isInteger(season.episode_count) && season.episode_count >= 0
            ? season.episode_count : null,
          airDate: dateOrNull(season.air_date),
        }))
        .sort((a, b) => a.seasonNumber - b.seasonNumber)
      : [];
    const latestSeasonSummary = [...seasons].reverse().find(
      (season) => season.seasonNumber > 0 && season.episodeCount !== 0,
    ) ?? null;
    const [extras, latestSeason, watchProviders] = await Promise.all([
      loadExtras(route, deps, mediaType, route.id),
      movie ? null : loadLatestSeason(route, deps, data.id, latestSeasonSummary),
      loadWatchProviders(route, deps, mediaType, route.id),
    ]);

    return { status: 200, body: { details: {
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
      genres: Array.isArray(data.genres)
        ? data.genres.map((genre) => textOrNull(genre?.name)).filter(Boolean) : [],
      seasons,
      nextEpisode: movie ? null : nextEpisodeOrNull(data.next_episode_to_air),
      latestSeason,
    } } };
  } catch (error) {
    return primaryError(error, 'title');
  }
}

export async function handleDetails(
  route,
  { token, fetchTmdbJson, optionalTimeoutMs = 3000, log } = {},
) {
  if (!token) return { status: 503, body: { error: 'Details are not configured yet.' } };
  const deps = { token, fetchTmdbJson, optionalTimeoutMs, log };
  if (route.kind === 'person-details') return loadPerson(route, deps);
  if (route.kind === 'season-details') return loadSeason(route, deps);
  return loadTitle(route, deps);
}
