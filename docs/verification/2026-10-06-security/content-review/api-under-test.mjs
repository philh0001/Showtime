var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../shared/library-data/collection-rules.mjs
var COLLECTION_NAMES = Object.freeze(["watchlist", "movie-progress", "tv-progress", "viewing-activity", "settings", "tv-ratings", "recommendation-dismissals", "notification-preferences"]);
var timezone = /* @__PURE__ */ __name((v) => {
  try {
    if (typeof v !== "string" || !v || v.length > 100) return false;
    new Intl.DateTimeFormat("en", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}, "timezone");
var object = /* @__PURE__ */ __name((v) => !!v && typeof v === "object" && !Array.isArray(v), "object");
var positive = /* @__PURE__ */ __name((v) => Number.isSafeInteger(v) && v > 0, "positive");
var text = /* @__PURE__ */ __name((v) => typeof v === "string" && v.trim().length > 0, "text");
var nullableText = /* @__PURE__ */ __name((v) => v === null || typeof v === "string", "nullableText");
var date = /* @__PURE__ */ __name((v) => typeof v === "string" && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v, "date");
var numbers = /* @__PURE__ */ __name((v) => Array.isArray(v) && v.every(positive) && new Set(v).size === v.length, "numbers");
var snapshot = /* @__PURE__ */ __name((v) => object(v) && positive(v.id) && ["Movie", "TV"].includes(v.mediaType) && text(v.title) && nullableText(v.year) && nullableText(v.posterUrl), "snapshot");
var unique = /* @__PURE__ */ __name((v, key) => new Set(v.map(key)).size === v.length, "unique");
var action = /* @__PURE__ */ __name((v, type) => object(v) && typeof v.watched === "boolean" && (v.kind === "movie" ? type === "Movie" : type === "TV" && positive(v.seasonNumber) && (v.kind === "season" || v.kind === "episode" && positive(v.episodeNumber) || v.kind === "aired" && numbers(v.episodeNumbers) && v.episodeNumbers.length > 0)), "action");
function validateSyncedCollection(name, data) {
  if (!COLLECTION_NAMES.includes(name)) return false;
  if (data === null) return true;
  if (name === "settings") return object(data) && typeof data.showTrending === "boolean";
  if (name === "notification-preferences") return object(data) && data.version === 1 && typeof data.enabled === "boolean" && numbers(data.showIds) && data.showIds.length <= 30 && ["release-day", "day-before"].includes(data.timing) && typeof data.dailyDigest === "boolean" && typeof data.dateAnnouncements === "boolean" && Number.isInteger(data.hour) && data.hour >= 0 && data.hour <= 23 && timezone(data.timezone);
  if (!Array.isArray(data)) return false;
  if (name === "watchlist") return data.every(snapshot) && unique(data, (v) => `${v.mediaType}:${v.id}`);
  if (name === "movie-progress") return data.every((v) => object(v) && positive(v.movieId) && text(v.title) && nullableText(v.year) && nullableText(v.posterUrl) && date(v.watchedAt)) && unique(data, (v) => v.movieId);
  if (name === "tv-progress") return data.every((v) => object(v) && positive(v.tvId) && numbers(v.trackableSeasonNumbers) && numbers(v.watchedSeasonNumbers) && Array.isArray(v.episodeProgress) && v.episodeProgress.every((e) => object(e) && positive(e.seasonNumber) && numbers(e.knownEpisodeNumbers) && numbers(e.trackableEpisodeNumbers) && numbers(e.watchedEpisodeNumbers)) && unique(v.episodeProgress, (e) => e.seasonNumber)) && unique(data, (v) => v.tvId);
  if (name === "viewing-activity") return data.every((v) => object(v) && positive(v.sequence) && date(v.happenedAt) && (v.id === void 0 || text(v.id)) && snapshot(v.title) && action(v.action, v.title.mediaType)) && unique(data, (v) => v.id ?? `legacy:${v.sequence}`);
  if (name === "tv-ratings") return data.every((v) => snapshot(v) && v.mediaType === "TV" && Number.isInteger(v.stars) && v.stars >= 1 && v.stars <= 5 && Array.isArray(v.genres) && v.genres.every((g) => typeof g === "string")) && unique(data, (v) => v.id);
  return numbers(data);
}
__name(validateSyncedCollection, "validateSyncedCollection");

// src/legacy-watchlist.ts
var cache = /* @__PURE__ */ new Map();
var pending = /* @__PURE__ */ new Map();
async function hydrateLegacyWatchlist(value, resolve) {
  if (validateSyncedCollection("watchlist", value)) return value;
  if (!Array.isArray(value)) throw new Error("Invalid legacy Watchlist");
  let lookups = 0;
  const items = value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item) || !Number.isSafeInteger(item.id) || item.id < 1 || !["Movie", "TV"].includes(item.mediaType) || Object.hasOwn(item, "title") && (typeof item.title !== "string" || !item.title.trim()) || Object.hasOwn(item, "year") && item.year !== null && typeof item.year !== "string" || Object.hasOwn(item, "posterUrl") && item.posterUrl !== null && typeof item.posterUrl !== "string") {
      throw new Error("Invalid legacy Watchlist");
    }
    if (!Object.hasOwn(item, "title")) lookups++;
    return item;
  });
  if (lookups > 4 || lookups && !resolve) throw new Error("Legacy metadata unavailable");
  const normalized = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++, item = items[index];
      normalized[index] = Object.hasOwn(item, "title") ? { ...item, year: item.year ?? null, posterUrl: item.posterUrl ?? null } : { ...item, ...await resolve(item), id: item.id, mediaType: item.mediaType };
    }
  }
  __name(worker, "worker");
  await Promise.all([worker(), worker()]);
  if (!validateSyncedCollection("watchlist", normalized)) throw new Error("Invalid legacy metadata");
  return normalized;
}
__name(hydrateLegacyWatchlist, "hydrateLegacyWatchlist");
function createLegacyTitleResolver(options) {
  return async (item) => {
    const key = `${item.mediaType}:${item.id}`;
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;
    const inFlight = pending.get(key);
    if (inFlight) return inFlight;
    const operation = (async () => {
      if (!options.token || !await options.charge()) throw new Error("Legacy metadata unavailable");
      const type = item.mediaType === "TV" ? "tv" : "movie";
      const data = await options.read({
        endpoint: `/3/${type}/${item.id}`,
        token: options.token,
        route: "legacy-watchlist",
        timeoutMs: 2e3
      });
      const title = type === "tv" ? data?.name : data?.title;
      if (data?.id !== item.id || typeof title !== "string" || !title.trim()) throw new Error("Legacy metadata unavailable");
      const date2 = type === "tv" ? data.first_air_date : data.release_date;
      const poster = data.poster_path;
      const value = {
        ...item,
        title: title.trim(),
        year: typeof date2 === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date2) ? date2.slice(0, 4) : null,
        posterUrl: typeof poster === "string" && /^\/[\w.-]+$/.test(poster) ? `https://image.tmdb.org/t/p/w500${poster}` : null
      };
      cache.delete(key);
      cache.set(key, { value, expires: Date.now() + 6e5 });
      if (cache.size > 100) cache.delete(cache.keys().next().value);
      return value;
    })();
    pending.set(key, operation);
    try {
      return await operation;
    } finally {
      if (pending.get(key) === operation) pending.delete(key);
    }
  };
}
__name(createLegacyTitleResolver, "createLegacyTitleResolver");

// ../../shared/tmdb-api/request.mjs
var MAX_URL_BYTES = 2048;
var MAX_SEARCH_LENGTH = 100;
var POSITIVE_INTEGER = /^[1-9]\d*$/;
var failure = /* @__PURE__ */ __name((status, error) => ({ ok: false, status, body: { error } }), "failure");
function success(route, method) {
  const parsedRoute = method === "OPTIONS" ? { kind: "options", cacheKey: route.cacheKey, cost: 0 } : route;
  return { ok: true, route: Object.freeze(parsedRoute) };
}
__name(success, "success");
function positiveSafeInteger(value) {
  if (!POSITIVE_INTEGER.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
__name(positiveSafeInteger, "positiveSafeInteger");
function hasNoncanonicalDotSegment(url) {
  const match = /^[a-z][a-z\d+.-]*:\/\/[^/?#]*([^?#]*)/i.exec(url);
  if (!match) return false;
  if (match[1].includes("\\")) return true;
  return match[1].split("/").some((segment) => {
    const dots = segment.replaceAll(/%2e/gi, ".");
    return dots === "." || dots === "..";
  });
}
__name(hasNoncanonicalDotSegment, "hasNoncanonicalDotSegment");
function noQueryParameters(incoming) {
  return [...incoming.searchParams].length === 0;
}
__name(noQueryParameters, "noQueryParameters");
function searchRoute(incoming) {
  const queries = incoming.searchParams.getAll("query");
  if ([...incoming.searchParams.keys()].some((key) => !["query", "type", "page"].includes(key)) || queries.length !== 1) {
    return failure(400, "Enter a title of 1\u2013100 characters.");
  }
  const query = queries[0].trim();
  if (query.length < 1 || query.length > MAX_SEARCH_LENGTH) {
    return failure(400, "Enter a title of 1\u2013100 characters.");
  }
  const types = incoming.searchParams.getAll("type");
  const pages = incoming.searchParams.getAll("page");
  const type = types[0] ?? "all";
  const page = pages.length ? positiveSafeInteger(pages[0]) : 1;
  if (types.length > 1 || pages.length > 1 || !["all", "tv", "movie"].includes(type) || page === null || page > 500) return failure(400, "Choose a valid search type and page.");
  const extended = types.length > 0 || pages.length > 0;
  return {
    ...extended ? { type, page } : {},
    kind: "search",
    query,
    cacheKey: `/search?${new URLSearchParams(extended ? { query, type, page: String(page) } : { query })}`,
    cost: 1
  };
}
__name(searchRoute, "searchRoute");
function detailsRoute(pathname) {
  const season = /^\/details\/tv\/([^/]*)\/season\/([^/]*)$/.exec(pathname);
  if (season) {
    const id2 = positiveSafeInteger(season[1]);
    const seasonNumber = positiveSafeInteger(season[2]);
    if (id2 === null || seasonNumber === null) {
      return failure(400, "Choose a valid TV season.");
    }
    return {
      kind: "season-details",
      id: id2,
      seasonNumber,
      cacheKey: `/details/tv/${id2}/season/${seasonNumber}`,
      cost: 1
    };
  }
  const details = /^\/details\/(movie|tv|person)\/([^/]*)$/.exec(pathname);
  if (!details) return null;
  const id = positiveSafeInteger(details[2]);
  if (id === null) return failure(400, "Choose a valid title or person.");
  const kind = `${details[1]}-details`;
  const cost = details[1] === "movie" ? 4 : details[1] === "tv" ? 5 : 1;
  return {
    kind,
    id,
    cacheKey: `/details/${details[1]}/${id}`,
    cost
  };
}
__name(detailsRoute, "detailsRoute");
function scheduleRoute(pathname) {
  const match = /^\/schedule\/tv\/([^/]*)$/.exec(pathname);
  if (!match) return null;
  const id = positiveSafeInteger(match[1]);
  if (id === null) return failure(400, "Choose a valid TV show.");
  return { kind: "tv-schedule", id, cacheKey: `/schedule/tv/${id}`, cost: 13 };
}
__name(scheduleRoute, "scheduleRoute");
function parseApiRequest({ method, url }) {
  if (new TextEncoder().encode(url).byteLength > MAX_URL_BYTES) {
    return failure(414, "Request URL is too long.");
  }
  let incoming;
  try {
    incoming = new URL(url);
  } catch {
    return failure(400, "Invalid request URL.");
  }
  if (!["GET", "OPTIONS"].includes(method)) {
    return { ...failure(405, "Use GET."), allow: "GET, OPTIONS" };
  }
  if (url.split(/[?#]/, 1)[0].includes("\\")) return failure(404, "Not found.");
  if (hasNoncanonicalDotSegment(url)) return failure(404, "Not found.");
  let route;
  if (incoming.pathname === "/search") {
    route = searchRoute(incoming);
  } else if (incoming.pathname === "/discovery") {
    route = noQueryParameters(incoming) ? { kind: "discovery", cacheKey: "/discovery", cost: 2 } : failure(400, "Query parameters are not allowed.");
  } else {
    const summary = /^\/summary\/tv\/([^/]*)$/.exec(incoming.pathname);
    route = summary ? positiveSafeInteger(summary[1]) === null ? failure(400, "Choose a valid TV show.") : { kind: "tv-summary", id: Number(summary[1]), cacheKey: `/summary/tv/${summary[1]}`, cost: 1 } : scheduleRoute(incoming.pathname) ?? detailsRoute(incoming.pathname);
    if (route && route.ok !== false && !noQueryParameters(incoming)) {
      route = failure(400, "Query parameters are not allowed.");
    }
  }
  if (!route) return failure(404, "Not found.");
  if (route.ok === false) return route;
  return success(route, method);
}
__name(parseApiRequest, "parseApiRequest");

// ../../shared/tmdb-api/details.mjs
var imageUrl = /* @__PURE__ */ __name((path, size) => typeof path === "string" && /^\/[\w.-]+$/.test(path) ? `https://image.tmdb.org/t/p/${size}${path}` : null, "imageUrl");
var textOrNull = /* @__PURE__ */ __name((value) => typeof value === "string" && value.trim() ? value.trim() : null, "textOrNull");
var dateOrNull = /* @__PURE__ */ __name((value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date2 = new Date(Date.UTC(year, month - 1, day));
  return date2.getUTCFullYear() === year && date2.getUTCMonth() === month - 1 && date2.getUTCDate() === day ? value : null;
}, "dateOrNull");
function mapPerson(data, id) {
  if (!data || data.id !== id || !textOrNull(data.name)) return null;
  const knownFor = Array.isArray(data.known_for) ? data.known_for.map((item) => textOrNull(item?.title ?? item?.name)).filter(Boolean).slice(0, 5) : [];
  return {
    id,
    name: textOrNull(data.name),
    biography: textOrNull(data.biography),
    birthday: dateOrNull(data.birthday),
    knownFor
  };
}
__name(mapPerson, "mapPerson");
function nextEpisodeOrNull(value) {
  if (!value || !Number.isSafeInteger(value.id) || value.id <= 0 || !Number.isInteger(value.season_number) || value.season_number < 0 || !Number.isInteger(value.episode_number) || value.episode_number <= 0) return null;
  const airDate = dateOrNull(value.air_date);
  return airDate ? {
    id: value.id,
    name: textOrNull(value.name),
    seasonNumber: value.season_number,
    episodeNumber: value.episode_number,
    airDate
  } : null;
}
__name(nextEpisodeOrNull, "nextEpisodeOrNull");
function episodeOrNull(value, seasonNumber) {
  if (!value || !Number.isSafeInteger(value.id) || value.id <= 0 || value.season_number !== seasonNumber || !Number.isInteger(value.episode_number) || value.episode_number <= 0) return null;
  return {
    id: value.id,
    name: textOrNull(value.name),
    seasonNumber,
    episodeNumber: value.episode_number,
    airDate: dateOrNull(value.air_date)
  };
}
__name(episodeOrNull, "episodeOrNull");
function mapExtras({ credits, videos }) {
  const cast = /* @__PURE__ */ new Map();
  for (const person of Array.isArray(credits?.cast) ? credits.cast : []) {
    if (!person || !Number.isSafeInteger(person.id) || person.id <= 0 || !textOrNull(person.name) || cast.has(person.id)) continue;
    cast.set(person.id, {
      id: person.id,
      name: textOrNull(person.name),
      character: textOrNull(person.character),
      profileUrl: imageUrl(person.profile_path, "w185")
    });
    if (cast.size === 12) break;
  }
  const crew = /* @__PURE__ */ new Map();
  for (const person of Array.isArray(credits?.crew) ? credits.crew : []) {
    if (!person || !Number.isSafeInteger(person.id) || person.id <= 0 || !textOrNull(person.name) || !["Director", "Writer", "Screenplay", "Creator", "Executive Producer"].includes(person.job)) continue;
    crew.set(`${person.id}:${person.job}`, {
      id: person.id,
      name: textOrNull(person.name),
      job: person.job
    });
    if (crew.size === 8) break;
  }
  const video = (Array.isArray(videos?.results) ? videos.results : []).find((item) => item?.site === "YouTube" && item.type === "Trailer" && item.official === true && typeof item.key === "string" && /^[A-Za-z0-9_-]{11}$/.test(item.key));
  return {
    cast: [...cast.values()],
    crew: [...crew.values()],
    trailer: video ? {
      name: textOrNull(video.name) ?? "Official trailer",
      url: `https://www.youtube.com/watch?v=${video.key}`
    } : null
  };
}
__name(mapExtras, "mapExtras");
var providerGroups = ["flatrate", "free", "ads", "rent", "buy"];
function normalizeProviderName(value) {
  const name = value.trim();
  const lower = name.toLowerCase();
  if (lower.includes("amazon prime") || lower === "prime video" || lower.includes("amazon video")) {
    return "Amazon Prime Video";
  }
  if (lower.includes("paramount")) return "Paramount+";
  if (lower.includes("netflix")) return "Netflix";
  if (lower.includes("disney")) return "Disney+";
  if (lower.includes("apple tv")) return "Apple TV";
  if (lower.includes("max")) return "Max";
  return name;
}
__name(normalizeProviderName, "normalizeProviderName");
function unavailableProviders() {
  return { status: "unavailable", region: "GB", link: null, providers: [] };
}
__name(unavailableProviders, "unavailableProviders");
function mapWatchProviders(data) {
  const region = data?.results?.GB;
  if (!region || typeof region !== "object") return unavailableProviders();
  const providers = [];
  const seen = /* @__PURE__ */ new Set();
  const seenProviderIds = /* @__PURE__ */ new Set();
  for (const group of providerGroups) {
    for (const provider of Array.isArray(region[group]) ? region[group] : []) {
      if (!provider || !Number.isSafeInteger(provider.provider_id) || provider.provider_id <= 0 || !textOrNull(provider.provider_name) || seenProviderIds.has(provider.provider_id)) continue;
      const offers = ["flatrate", "free", "ads"].includes(group) ? "stream" : group;
      const name = normalizeProviderName(provider.provider_name);
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      providers.push({
        id: provider.provider_id,
        name,
        logoUrl: imageUrl(provider.logo_path, "w92"),
        offers
      });
      seen.add(key);
      seenProviderIds.add(provider.provider_id);
      if (providers.length === 20) break;
    }
    if (providers.length === 20) break;
  }
  const link = typeof region.link === "string" && /^https:\/\/www\.themoviedb\.org\/.+/.test(region.link) ? region.link : null;
  return {
    status: providers.length ? "available" : "none",
    region: "GB",
    link,
    providers
  };
}
__name(mapWatchProviders, "mapWatchProviders");
function requestOptions(route, deps, endpoint, timeoutMs) {
  return {
    endpoint,
    route: route.kind,
    token: deps.token,
    ...timeoutMs === void 0 ? {} : { timeoutMs },
    ...deps.log ? { log: deps.log } : {}
  };
}
__name(requestOptions, "requestOptions");
async function loadOptionalJson(route, deps, endpoint) {
  try {
    return await deps.fetchTmdbJson(requestOptions(route, deps, endpoint, deps.optionalTimeoutMs));
  } catch {
    return null;
  }
}
__name(loadOptionalJson, "loadOptionalJson");
async function loadExtras(route, deps, mediaType, id) {
  const [credits, videos] = await Promise.all([
    loadOptionalJson(route, deps, `/3/${mediaType}/${id}/credits`),
    loadOptionalJson(route, deps, `/3/${mediaType}/${id}/videos`)
  ]);
  return mapExtras({ credits, videos });
}
__name(loadExtras, "loadExtras");
async function loadWatchProviders(route, deps, mediaType, id) {
  const data = await loadOptionalJson(
    route,
    deps,
    `/3/${mediaType}/${id}/watch/providers?watch_region=GB`
  );
  return data === null ? unavailableProviders() : mapWatchProviders(data);
}
__name(loadWatchProviders, "loadWatchProviders");
async function loadLatestSeason(route, deps, tvId, season) {
  if (!season) return null;
  const data = await loadOptionalJson(
    route,
    deps,
    `/3/tv/${tvId}/season/${season.seasonNumber}`
  );
  if (!data || data.id !== season.id || data.season_number !== season.seasonNumber || !Array.isArray(data.episodes)) return null;
  const episodes = data.episodes.map((episode) => episodeOrNull(episode, season.seasonNumber)).filter(Boolean).sort((a, b) => a.episodeNumber - b.episodeNumber || a.id - b.id);
  return {
    seasonNumber: season.seasonNumber,
    name: textOrNull(data.name) ?? season.name,
    episodes
  };
}
__name(loadLatestSeason, "loadLatestSeason");
function primaryError(error, subject) {
  if (error?.kind === "not-found") {
    const noun = subject === "title" ? "title" : subject;
    return { status: 404, body: { error: `This ${noun} could not be found.` } };
  }
  if (error?.kind === "throttled") {
    return { status: 429, body: { error: "Please wait a moment and try again." } };
  }
  if (error?.kind === "upstream" && Number.isInteger(error.status) && error.status > 0) {
    const prefix2 = subject === "title" ? "Details" : `${subject[0].toUpperCase()}${subject.slice(1)} details`;
    return { status: 502, body: { error: `${prefix2} are temporarily unavailable.` } };
  }
  const prefix = subject === "title" ? "details" : `${subject} details`;
  return { status: 502, body: { error: `Could not load ${prefix}. Please try again.` } };
}
__name(primaryError, "primaryError");
async function loadPerson(route, deps) {
  try {
    const data = await deps.fetchTmdbJson(requestOptions(
      route,
      deps,
      `/3/person/${route.id}`
    ));
    const person = mapPerson(data, route.id);
    if (!person) throw new TypeError("Invalid person response");
    return { status: 200, body: { person } };
  } catch (error) {
    return primaryError(error, "person");
  }
}
__name(loadPerson, "loadPerson");
async function loadSeason(route, deps) {
  try {
    const data = await deps.fetchTmdbJson(requestOptions(
      route,
      deps,
      `/3/tv/${route.id}/season/${route.seasonNumber}`
    ));
    if (!Number.isSafeInteger(data?.id) || data.id <= 0 || data.season_number !== route.seasonNumber || !Array.isArray(data.episodes)) throw new TypeError("Invalid season response");
    return {
      status: 200,
      body: {
        season: {
          seasonNumber: route.seasonNumber,
          name: textOrNull(data.name) ?? `Season ${route.seasonNumber}`,
          episodes: data.episodes.map((episode) => episodeOrNull(episode, route.seasonNumber)).filter(Boolean).sort((a, b) => a.episodeNumber - b.episodeNumber || a.id - b.id)
        }
      }
    };
  } catch (error) {
    return primaryError(error, "season");
  }
}
__name(loadSeason, "loadSeason");
async function loadTitle(route, deps) {
  const movie = route.kind === "movie-details";
  const mediaType = movie ? "movie" : "tv";
  try {
    const data = await deps.fetchTmdbJson(requestOptions(
      route,
      deps,
      `/3/${mediaType}/${route.id}`
    ));
    if (!data || data.id !== route.id) throw new TypeError("Invalid detail response");
    const seasons = !movie && Array.isArray(data.seasons) ? data.seasons.filter((season) => season && Number.isSafeInteger(season.id) && Number.isInteger(season.season_number) && season.season_number >= 0).map((season) => ({
      id: season.id,
      name: textOrNull(season.name) ?? (season.season_number === 0 ? "Specials" : `Season ${season.season_number}`),
      seasonNumber: season.season_number,
      episodeCount: Number.isInteger(season.episode_count) && season.episode_count >= 0 ? season.episode_count : null,
      airDate: dateOrNull(season.air_date)
    })).sort((a, b) => a.seasonNumber - b.seasonNumber) : [];
    const latestSeasonSummary = [...seasons].reverse().find(
      (season) => season.seasonNumber > 0 && season.episodeCount !== 0
    ) ?? null;
    const [extras, latestSeason, watchProviders] = await Promise.all([
      loadExtras(route, deps, mediaType, route.id),
      movie ? null : loadLatestSeason(route, deps, data.id, latestSeasonSummary),
      loadWatchProviders(route, deps, mediaType, route.id)
    ]);
    return { status: 200, body: { details: {
      ...extras,
      watchProviders,
      id: data.id,
      mediaType: movie ? "Movie" : "TV",
      title: textOrNull(movie ? data.title : data.name) ?? "Untitled",
      overview: textOrNull(data.overview),
      releaseDate: dateOrNull(movie ? data.release_date : data.first_air_date),
      posterUrl: imageUrl(data.poster_path, "w500"),
      backdropUrl: imageUrl(data.backdrop_path, "w780"),
      rating: data.vote_count > 0 && Number.isFinite(data.vote_average) && data.vote_average >= 0 && data.vote_average <= 10 ? data.vote_average : null,
      genres: Array.isArray(data.genres) ? data.genres.map((genre) => textOrNull(genre?.name)).filter(Boolean) : [],
      seasons,
      nextEpisode: movie ? null : nextEpisodeOrNull(data.next_episode_to_air),
      latestSeason,
      ...!movie && lifecycleStatus(data.status) ? { status: lifecycleStatus(data.status) } : {}
    } } };
  } catch (error) {
    return primaryError(error, "title");
  }
}
__name(loadTitle, "loadTitle");
async function handleDetails(route, { token, fetchTmdbJson: fetchTmdbJson2, optionalTimeoutMs = 3e3, log } = {}) {
  if (!token) return { status: 503, body: { error: "Details are not configured yet." } };
  const deps = { token, fetchTmdbJson: fetchTmdbJson2, optionalTimeoutMs, log };
  if (route.kind === "person-details") return loadPerson(route, deps);
  if (route.kind === "season-details") return loadSeason(route, deps);
  return loadTitle(route, deps);
}
__name(handleDetails, "handleDetails");
function lifecycleStatus(value) {
  return ["Returning Series", "Planned", "In Production", "Ended", "Canceled", "Pilot"].includes(value) ? value : null;
}
__name(lifecycleStatus, "lifecycleStatus");
async function handleSummary(route, { token, fetchTmdbJson: fetchTmdbJson2, log } = {}) {
  if (!token) return { status: 503, body: { error: "Details are not configured yet." } };
  try {
    const data = await fetchTmdbJson2({ endpoint: `/3/tv/${route.id}`, route: "tv-summary", token, ...log ? { log } : {} });
    if (data?.id !== route.id || !textOrNull(data.name)) throw new TypeError("Invalid summary");
    return { status: 200, body: { summary: {
      id: data.id,
      mediaType: "TV",
      title: textOrNull(data.name),
      genres: Array.isArray(data.genres) ? data.genres.map((genre) => textOrNull(genre?.name)).filter(Boolean) : [],
      nextEpisode: nextEpisodeOrNull(data.next_episode_to_air),
      status: lifecycleStatus(data.status),
      posterUrl: imageUrl(data.poster_path, "w500"),
      releaseDate: dateOrNull(data.first_air_date)
    } } };
  } catch (error) {
    return primaryError(error, "title");
  }
}
__name(handleSummary, "handleSummary");

// ../../shared/tmdb-api/discovery.mjs
function mapDiscoveryList(data, type) {
  if (!Array.isArray(data?.results)) throw new TypeError("Invalid discovery response");
  const items = /* @__PURE__ */ new Map();
  for (const item of data.results) {
    if (!item || !Number.isSafeInteger(item.id) || item.id <= 0 || item.adult === true || items.has(item.id)) continue;
    const movie = type === "movie";
    const title = movie ? item.title : item.name;
    if (typeof title !== "string" || !title.trim()) continue;
    const date2 = movie ? item.release_date : item.first_air_date;
    items.set(item.id, {
      id: item.id,
      title: title.trim(),
      mediaType: movie ? "Movie" : "TV",
      year: typeof date2 === "string" && /^\d{4}-/.test(date2) ? date2.slice(0, 4) : null,
      posterUrl: typeof item.poster_path === "string" && /^\/[\w.-]+$/.test(item.poster_path) ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null
    });
    if (items.size === 20) break;
  }
  return [...items.values()];
}
__name(mapDiscoveryList, "mapDiscoveryList");
async function handleDiscovery(_route, { token, fetchTmdbJson: fetchTmdbJson2, log }) {
  if (!token) return { status: 503, body: { error: "Discovery is not configured yet." } };
  try {
    const [movies, tv] = await Promise.all([
      fetchTmdbJson2({ endpoint: "/3/trending/movie/week?language=en-GB", route: "discovery", token, ...log ? { log } : {} }),
      fetchTmdbJson2({ endpoint: "/3/trending/tv/week?language=en-GB", route: "discovery", token, ...log ? { log } : {} })
    ]);
    return {
      status: 200,
      body: {
        movies: mapDiscoveryList(movies, "movie"),
        tv: mapDiscoveryList(tv, "tv")
      }
    };
  } catch {
    return {
      status: 502,
      body: { error: "Discovery is temporarily unavailable. Please try again." }
    };
  }
}
__name(handleDiscovery, "handleDiscovery");

// ../../shared/tmdb-api/search.mjs
function mapSearchResults(results, type = "all") {
  return results.filter((item) => item && Number.isInteger(item.id) && ["movie", "tv"].includes(type === "all" ? item.media_type : type)).map((item) => {
    item = type === "all" ? item : { ...item, media_type: type };
    const movie = item.media_type === "movie";
    const date2 = movie ? item.release_date : item.first_air_date;
    const title = movie ? item.title : item.name;
    return {
      id: `${item.media_type}-${item.id}`,
      title: typeof title === "string" && title.trim() ? title : "Untitled",
      year: typeof date2 === "string" && /^\d{4}-/.test(date2) ? date2.slice(0, 4) : null,
      mediaType: movie ? "Movie" : "TV",
      posterUrl: typeof item.poster_path === "string" && /^\/[\w.-]+$/.test(item.poster_path) ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null
    };
  });
}
__name(mapSearchResults, "mapSearchResults");
function mapSearchError(error) {
  if (error?.kind === "throttled") {
    return { status: 429, body: { error: "Please wait a moment before searching again." } };
  }
  if (error?.kind === "timeout") {
    return { status: 502, body: { error: "Could not reach the search service. Please try again." } };
  }
  if (error?.kind === "upstream" && error.status === 0) {
    return { status: 502, body: { error: "Could not reach the search service. Please try again." } };
  }
  if (["not-found", "upstream", "invalid-body", "too-large"].includes(error?.kind)) {
    return { status: 502, body: { error: "Search is temporarily unavailable. Please try again." } };
  }
  return { status: 502, body: { error: "Could not reach the search service. Please try again." } };
}
__name(mapSearchError, "mapSearchError");
async function handleSearch(route, { token, fetchTmdbJson: fetchTmdbJson2, log }) {
  if (!token) return { status: 503, body: { error: "Search is not configured yet." } };
  try {
    const query = new URLSearchParams({
      query: route.query,
      include_adult: "false",
      page: String(route.page ?? 1)
    });
    const data = await fetchTmdbJson2({
      endpoint: `/3/search/${route.type === "tv" || route.type === "movie" ? route.type : "multi"}?${query}`,
      route: "search",
      token,
      ...log ? { log } : {}
    });
    if (!Array.isArray(data?.results)) throw new TypeError("Invalid search response");
    return { status: 200, body: {
      results: mapSearchResults(data.results, route.type),
      ...route.type !== void 0 || route.page !== void 0 ? {
        page: route.page ?? 1,
        totalPages: Number.isSafeInteger(data.total_pages) && data.total_pages >= 0 ? Math.min(500, data.total_pages) : 1,
        totalResults: Number.isSafeInteger(data.total_results) && data.total_results >= 0 ? data.total_results : data.results.length
      } : {}
    } };
  } catch (error) {
    return mapSearchError(error);
  }
}
__name(handleSearch, "handleSearch");

// ../../shared/tmdb-api/schedule.mjs
var MAX_SEASONS = 12;
var MAX_EPISODES = 200;
var MAX_SEASON_SUMMARIES = 100;
var textOrNull2 = /* @__PURE__ */ __name((value) => typeof value === "string" && value.trim() ? value.trim() : null, "textOrNull");
var imageUrl2 = /* @__PURE__ */ __name((path) => typeof path === "string" && /^\/[\w.-]+$/.test(path) ? `https://image.tmdb.org/t/p/w500${path}` : null, "imageUrl");
function dateOrNull2(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date2 = new Date(Date.UTC(year, month - 1, day));
  return date2.getUTCFullYear() === year && date2.getUTCMonth() === month - 1 && date2.getUTCDate() === day ? value : null;
}
__name(dateOrNull2, "dateOrNull");
function episodeOrNull2(value, seasonNumber, cutoff) {
  if (!value || !Number.isSafeInteger(value.id) || value.id <= 0 || value.season_number !== seasonNumber || !Number.isSafeInteger(value.episode_number) || value.episode_number <= 0) return null;
  const airDate = dateOrNull2(value.air_date);
  if (!airDate || airDate < cutoff) return null;
  return {
    id: value.id,
    name: textOrNull2(value.name),
    seasonNumber,
    episodeNumber: value.episode_number,
    airDate
  };
}
__name(episodeOrNull2, "episodeOrNull");
function validSeasons(value) {
  if (!Array.isArray(value)) return null;
  const byNumber = /* @__PURE__ */ new Map();
  for (const season of value) {
    if (!season || !Number.isSafeInteger(season.season_number) || season.season_number < 0) return null;
    if (season.season_number === 0) continue;
    if (!Number.isSafeInteger(season.id) || season.id <= 0 || !Number.isSafeInteger(season.episode_count) || season.episode_count < 0) return null;
    if (season.episode_count === 0) continue;
    byNumber.set(season.season_number, { id: season.id, number: season.season_number });
    if (byNumber.size > MAX_SEASON_SUMMARIES) return null;
  }
  return [...byNumber.values()].sort((a, b) => b.number - a.number);
}
__name(validSeasons, "validSeasons");
async function fetchSeason(route, deps, season, cutoff) {
  try {
    const data = await deps.fetchTmdbJson({
      endpoint: `/3/tv/${route.id}/season/${season.number}`,
      route: route.kind,
      token: deps.token,
      timeoutMs: Math.max(1, Math.min(4e3, deps.deadline - Date.now())),
      ...deps.log ? { log: deps.log } : {}
    });
    if (!data || data.id !== season.id || data.season_number !== season.number || !Array.isArray(data.episodes)) return null;
    return data.episodes.map((item) => episodeOrNull2(item, season.number, cutoff)).filter(Boolean);
  } catch {
    return null;
  }
}
__name(fetchSeason, "fetchSeason");
function uniqueSortedEpisodes(episodes) {
  const byId = /* @__PURE__ */ new Set();
  const bySlot = /* @__PURE__ */ new Set();
  return episodes.sort((a, b) => a.airDate.localeCompare(b.airDate) || a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber || a.id - b.id).filter((item) => {
    const slot = `${item.seasonNumber}:${item.episodeNumber}`;
    if (byId.has(item.id) || bySlot.has(slot)) return false;
    byId.add(item.id);
    bySlot.add(slot);
    return true;
  });
}
__name(uniqueSortedEpisodes, "uniqueSortedEpisodes");
async function handleSchedule(route, { token, fetchTmdbJson: fetchTmdbJson2, now = /* @__PURE__ */ new Date(), log, deadlineMs = 12e3 } = {}) {
  if (!token) return { status: 503, body: { error: "Schedule is not configured yet." } };
  if (route?.kind !== "tv-schedule" || !Number.isSafeInteger(route.id) || route.id <= 0 || typeof fetchTmdbJson2 !== "function") {
    return { status: 502, body: { error: "Could not load schedule. Please try again." } };
  }
  const deadline = Date.now() + Math.max(1, Math.min(12e3, deadlineMs));
  const boundedFetch = /* @__PURE__ */ __name(async (options) => {
    const remaining = Math.max(1, deadline - Date.now());
    let timer;
    try {
      return await Promise.race([
        fetchTmdbJson2({ ...options, timeoutMs: Math.min(options.timeoutMs ?? 4e3, remaining) }),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject({ kind: "timeout" }), remaining);
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  }, "boundedFetch");
  const cutoffDate = new Date(now);
  cutoffDate.setUTCHours(0, 0, 0, 0);
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 2);
  const cutoff = cutoffDate.toISOString().slice(0, 10);
  let summary;
  try {
    summary = await boundedFetch({
      endpoint: `/3/tv/${route.id}`,
      route: route.kind,
      token,
      ...log ? { log } : {}
    });
  } catch (error) {
    const status = error?.kind === "not-found" ? 404 : error?.kind === "throttled" ? 429 : 502;
    return { status, body: { error: status === 404 ? "This TV show could not be found." : status === 429 ? "Please wait a moment and try again." : "Could not load schedule. Please try again." } };
  }
  const title = textOrNull2(summary?.name);
  const seasons = validSeasons(summary?.seasons);
  if (summary?.id !== route.id || !title || !seasons) {
    return { status: 502, body: { error: "Could not load schedule. Please try again." } };
  }
  const prioritySeason = summary.next_episode_to_air?.season_number;
  const selected = [...seasons].sort((a, b) => (b.number === prioritySeason ? 1 : 0) - (a.number === prioritySeason ? 1 : 0) || b.number - a.number).slice(0, MAX_SEASONS);
  const results = new Array(selected.length);
  let cursor = 0;
  async function worker() {
    while (cursor < selected.length) {
      const index = cursor++;
      results[index] = Date.now() >= deadline ? null : await fetchSeason(route, { token, fetchTmdbJson: boundedFetch, log, deadline }, selected[index], cutoff);
    }
  }
  __name(worker, "worker");
  await Promise.all(Array.from({ length: Math.min(3, selected.length) }, () => worker()));
  const seasonCoverage = new Map(seasons.map((season) => [season.number, "limited"]));
  const allEpisodes = [];
  selected.forEach((season, index) => {
    seasonCoverage.set(season.number, results[index] === null ? "unavailable" : "checked");
    if (results[index]) allEpisodes.push(...results[index]);
  });
  const sorted = uniqueSortedEpisodes(allEpisodes);
  for (const item of sorted.slice(MAX_EPISODES)) seasonCoverage.set(item.seasonNumber, "limited");
  const coverage = [...seasonCoverage.values()].every((status) => status === "checked") ? "complete" : "partial";
  const nextValue = summary.next_episode_to_air;
  const nextEpisode = nextValue && Number.isSafeInteger(nextValue.season_number) && nextValue.season_number > 0 && seasonCoverage.get(nextValue.season_number) !== "checked" ? episodeOrNull2(nextValue, nextValue.season_number, cutoff) : null;
  return { status: 200, body: { schedule: {
    id: route.id,
    title,
    posterUrl: imageUrl2(summary.poster_path),
    episodes: sorted.slice(0, MAX_EPISODES),
    seasonCoverage: [...seasonCoverage].sort(([a], [b]) => a - b).map(([seasonNumber, status]) => ({ seasonNumber, status })),
    coverage,
    nextEpisode,
    ...lifecycleStatus(summary.status) ? { status: lifecycleStatus(summary.status) } : {}
  } } };
}
__name(handleSchedule, "handleSchedule");

// ../../shared/tmdb-api/tmdb.mjs
var TMDB_ORIGIN = "https://api.themoviedb.org";
var DEFAULT_TIMEOUT_MS = 1e4;
var MAX_BODY_BYTES = 4 * 1024 * 1024;
var TmdbError = class extends Error {
  static {
    __name(this, "TmdbError");
  }
  constructor(kind, status = 0) {
    super(`TMDB request failed: ${kind}`);
    this.name = "TmdbError";
    this.kind = kind;
    this.status = status;
  }
};
function validateEndpoint(endpoint) {
  if (typeof endpoint !== "string" || !endpoint.startsWith("/3/") || /[\\\u0000-\u001f\u007f]/.test(endpoint)) {
    throw new TypeError("Invalid TMDB endpoint");
  }
  const pathname = endpoint.split(/[?#]/, 1)[0];
  if (pathname.split("/").some((segment) => {
    const dots = segment.replaceAll(/%2e/gi, ".");
    return dots === "." || dots === "..";
  })) {
    throw new TypeError("Invalid TMDB endpoint");
  }
  const url = new URL(endpoint, TMDB_ORIGIN);
  if (url.origin !== TMDB_ORIGIN || url.username || url.password || !url.pathname.startsWith("/3/")) {
    throw new TypeError("Invalid TMDB origin");
  }
  return url;
}
__name(validateEndpoint, "validateEndpoint");
function classifyStatus(status) {
  if (status === 404) return "not-found";
  if (status === 429) return "throttled";
  return "upstream";
}
__name(classifyStatus, "classifyStatus");
function readWithSignal(reader, signal, status) {
  if (signal.aborted) return Promise.reject(new TmdbError("timeout", status));
  return new Promise((resolve, reject) => {
    const onAbort = /* @__PURE__ */ __name(() => reject(new TmdbError("timeout", status)), "onAbort");
    signal.addEventListener("abort", onAbort, { once: true });
    reader.read().then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", onAbort);
    });
  });
}
__name(readWithSignal, "readWithSignal");
async function readBoundedBody(response, maxBytes, signal) {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    throw new TmdbError("too-large", response.status);
  }
  if (!response.body) throw new TmdbError("invalid-body", response.status);
  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await readWithSignal(reader, signal, response.status);
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        void reader.cancel().catch(() => {
        });
        throw new TmdbError("too-large", response.status);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof TmdbError) {
      if (error.kind === "timeout") void reader.cancel().catch(() => {
      });
      throw error;
    }
    void reader.cancel().catch(() => {
    });
    throw new TmdbError(signal.aborted ? "timeout" : "upstream", response.status);
  } finally {
    try {
      reader.releaseLock();
    } catch {
    }
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
__name(readBoundedBody, "readBoundedBody");
function emitLog(log, route, status, startedAt) {
  try {
    log({
      route,
      status,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt))
    });
  } catch {
  }
}
__name(emitLog, "emitLog");
async function fetchTmdbJson({
  endpoint,
  route,
  token,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = MAX_BODY_BYTES,
  log = /* @__PURE__ */ __name(() => {
  }, "log")
}) {
  const url = validateEndpoint(endpoint);
  if (typeof token !== "string" || token.length === 0) throw new TypeError("Missing TMDB token");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError("Invalid timeout");
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new TypeError("Invalid body limit");
  const startedAt = performance.now();
  let status = 0;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const { signal } = controller;
  try {
    let response;
    try {
      response = await fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          accept: "application/json"
        },
        redirect: "manual",
        signal
      });
    } catch {
      if (signal.aborted) throw new TmdbError("timeout");
      throw new TmdbError("upstream");
    }
    status = response.status;
    if (status >= 300 && status < 400) throw new TmdbError("upstream", status);
    if (!response.ok) throw new TmdbError(classifyStatus(status), status);
    const text2 = await readBoundedBody(response, maxBytes, signal);
    try {
      return JSON.parse(text2);
    } catch {
      throw new TmdbError("invalid-body", status);
    }
  } finally {
    clearTimeout(timeout);
    emitLog(log, route, status, startedAt);
  }
}
__name(fetchTmdbJson, "fetchTmdbJson");

// src/cors.ts
function parseAllowedOrigins(value) {
  if (typeof value !== "string") return /* @__PURE__ */ new Set();
  return new Set(value.split(",").map((origin) => origin.trim()).filter(Boolean));
}
__name(parseAllowedOrigins, "parseAllowedOrigins");
function isAllowedOrigin(origin, allowed) {
  return origin === null || allowed.has(origin);
}
__name(isAllowedOrigin, "isAllowedOrigin");
function preflightHeaders() {
  return new Headers({
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600"
  });
}
__name(preflightHeaders, "preflightHeaders");
function accountPreflightHeaders() {
  return new Headers({
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "600"
  });
}
__name(accountPreflightHeaders, "accountPreflightHeaders");

// src/logging.ts
function logEvent(event) {
  try {
    console.log(JSON.stringify(event));
  } catch {
  }
}
__name(logEvent, "logEvent");
function logUpstream(event) {
  try {
    console.log(JSON.stringify({ ...event, source: "tmdb" }));
  } catch {
  }
}
__name(logUpstream, "logUpstream");

// src/response.ts
function corsHeaders(origin, allowed) {
  const headers = new Headers({ Vary: "Origin" });
  if (origin && allowed.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}
__name(corsHeaders, "corsHeaders");
function withSecurityHeaders(headers, requestId, status) {
  const result = new Headers(headers);
  result.set("X-Content-Type-Options", "nosniff");
  result.set("Referrer-Policy", "no-referrer");
  result.set("X-Request-ID", requestId);
  if (status >= 400) result.set("Cache-Control", "no-store");
  return result;
}
__name(withSecurityHeaders, "withSecurityHeaders");
function jsonResponse(status, body, requestId, headers = {}) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  const securedHeaders = withSecurityHeaders(responseHeaders, requestId, status);
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: securedHeaders
  });
}
__name(jsonResponse, "jsonResponse");

// src/rate-limit.ts
async function enforceRateLimits(route, env, clientKey, options = {}) {
  const category = route.kind === "search" ? env.SEARCH_LIMITER : route.kind === "discovery" ? env.DISCOVERY_LIMITER : env.DETAILS_LIMITER;
  if (options.category !== false && category && !(await category.limit({ key: clientKey })).success) return false;
  if (!env.WORK_LIMITER) return true;
  for (let unit = 0; unit < route.cost; unit += 1) {
    if (!(await env.WORK_LIMITER.limit({ key: clientKey })).success) return false;
  }
  return true;
}
__name(enforceRateLimits, "enforceRateLimits");

// src/cache.ts
var CACHE_ORIGIN = "https://showtime-api.internal";
var pending2 = /* @__PURE__ */ new WeakMap();
function ttlFor(route, result) {
  if (route.kind === "search") return 0;
  if (route.kind === "discovery") return 1800;
  const body = result?.body;
  const lifecycle = body?.summary?.status ?? body?.details?.status ?? body?.schedule?.status;
  return lifecycle === "Ended" || lifecycle === "Canceled" ? 21600 : 600;
}
__name(ttlFor, "ttlFor");
function temporaryGap(route, result) {
  const body = result.body;
  return route.kind === "tv-schedule" && body?.schedule?.seasonCoverage?.some((s) => s.status === "unavailable") === true;
}
__name(temporaryGap, "temporaryGap");
async function withApiCache(route, cache2, load, ctx) {
  if (!ttlFor(route)) return { result: await load(), outcome: "bypass" };
  const prefix = route.namespace ? `/${encodeURIComponent(route.namespace)}` : "";
  const key = new Request(new URL(`${prefix}${route.cacheKey}`, CACHE_ORIGIN));
  const staleKey = new Request(new URL(`${prefix}/last-known${route.cacheKey}`, CACHE_ORIGIN));
  try {
    const hit = await cache2.match(key);
    if (hit) return { result: { status: hit.status, body: await hit.json() }, outcome: "hit" };
  } catch {
  }
  let requests = pending2.get(cache2);
  if (!requests) {
    requests = /* @__PURE__ */ new Map();
    pending2.set(cache2, requests);
  }
  const existing = requests.get(key.url);
  const work = existing ?? (async () => {
    const result = await load();
    if (result.status === 200 && !temporaryGap(route, result)) {
      const stored = new Response(JSON.stringify(result.body), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": `max-age=${ttlFor(route, result)}`
        }
      });
      ctx.waitUntil(Promise.all([
        cache2.put(key, stored.clone()),
        cache2.put(staleKey, new Response(JSON.stringify(result.body), {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "max-age=86400"
          }
        }))
      ]).catch(() => void 0));
    }
    return result;
  })();
  if (!existing) requests.set(key.url, work);
  try {
    const result = await work;
    if (result.status >= 500 || result.status === 429) {
      try {
        const stale = await cache2.match(staleKey);
        if (stale) {
          const body = await stale.json();
          return { result: { status: 200, body: { ...body, freshness: "stale" } }, outcome: "stale" };
        }
      } catch {
      }
    }
    return { result, outcome: existing ? "coalesced" : "miss" };
  } finally {
    if (!existing) requests.delete(key.url);
  }
}
__name(withApiCache, "withApiCache");

// src/auth/crypto.ts
var ITERATIONS = 1e5;
var KEY_LENGTH_BITS = 256;
function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
__name(toBase64Url, "toBase64Url");
function fromBase64Url(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
__name(fromBase64Url, "fromBase64Url");
async function derivePbkdf2Bits(password, salt, iterations, lengthBits) {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, keyMaterial, lengthBits);
  return new Uint8Array(bits);
}
__name(derivePbkdf2Bits, "derivePbkdf2Bits");
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePbkdf2Bits(password, salt, ITERATIONS, KEY_LENGTH_BITS);
  return `pbkdf2$${ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, stored) {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations <= 0 || iterations > 1e6) return false;
  let salt;
  let expected;
  try {
    salt = fromBase64Url(parts[2]);
    expected = fromBase64Url(parts[3]);
  } catch {
    return false;
  }
  const actual = await derivePbkdf2Bits(password, salt, iterations, expected.length * 8);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < actual.length; index += 1) diff |= actual[index] ^ expected[index];
  return diff === 0;
}
__name(verifyPassword, "verifyPassword");
function randomToken(bytes = 32) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}
__name(randomToken, "randomToken");
async function sha256Hex(input) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(sha256Hex, "sha256Hex");
function newId() {
  return crypto.randomUUID();
}
__name(newId, "newId");

// src/email.ts
async function sendEmail(config, message) {
  return postEmail(config, { from: config.from, ...message });
}
__name(sendEmail, "sendEmail");
async function postEmail(config, body, timeoutMs = 8e3) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await Promise.race([
      fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(body), redirect: "manual", signal: controller.signal }),
      new Promise((_, reject) => controller.signal.addEventListener("abort", () => reject(new Error("Email delivery timed out")), { once: true }))
    ]);
    if (!response.ok) {
      void response.body?.cancel().catch(() => {
      });
      throw new Error(`Email delivery failed (${response.status})`);
    }
    void response.body?.cancel().catch(() => {
    });
  } finally {
    clearTimeout(timeout);
  }
}
__name(postEmail, "postEmail");
async function sendVerificationEmail(config, to, verificationUrl) {
  if (!config.verificationTemplateId) {
    const message = verificationEmail(config.appName, verificationUrl);
    return sendEmail(config, { to, ...message });
  }
  return postEmail(config, { from: config.from, to, template: { id: config.verificationTemplateId, variables: { verification_url: verificationUrl } } });
}
__name(sendVerificationEmail, "sendVerificationEmail");
var BRAND_NAME = "SHOWTIME";
var BRAND_TAGLINE = "TRACK \u2022 WATCH \u2022 DISCOVER";
function wrapHtml(_appName, heading, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#0B0B0F;font-family:Arial,Helvetica,sans-serif;color:#DDDEE3;line-height:1.5">
<main style="max-width:560px;margin:0 auto;padding:32px 24px">
<header style="margin-bottom:32px">
<p style="margin:0;color:#D6A832;font-size:28px;font-weight:700;letter-spacing:1px">${BRAND_NAME}</p>
<p style="margin:6px 0 0;color:#D8D8D8;font-size:11px;letter-spacing:3px">${BRAND_TAGLINE}</p>
</header>
<section style="background:#111318;border-radius:12px;padding:24px">
<h2 style="margin:0 0 16px;color:#FFFFFF">${heading}</h2>
${bodyHtml}
</section>
<p style="color:#A7A7B0;font-size:12px;margin:24px 0 0">${BRAND_NAME}</p>
</main>
</body></html>`;
}
__name(wrapHtml, "wrapHtml");
function verificationEmail(appName, verificationUrl) {
  return {
    subject: `Verify your ${appName} email`,
    html: wrapHtml(
      appName,
      "Verify your email",
      `<p>Select the link below to verify your email and enable sync across devices:</p>
<p><a href="${verificationUrl}">Verify your email</a></p>
<p>This link expires in 24 hours. If you didn't create this account, you can ignore this email.</p>`
    ),
    text: `Verify your ${appName} email: ${verificationUrl}
This link expires in 24 hours.`
  };
}
__name(verificationEmail, "verificationEmail");
function passwordResetEmail(appName, token) {
  return {
    subject: `Reset your ${appName} password`,
    html: wrapHtml(
      appName,
      "Reset your password",
      `<p>Enter this code in the app to reset your password:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:2px">${token}</p>
<p>This code expires in 1 hour. If you didn't request this, you can ignore this email.</p>`
    ),
    text: `Reset your ${appName} password by entering this code in the app: ${token}
This code expires in 1 hour.`
  };
}
__name(passwordResetEmail, "passwordResetEmail");

// src/auth/db.ts
async function findUserByEmail(db, email) {
  return await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first() ?? null;
}
__name(findUserByEmail, "findUserByEmail");
async function findUserById(db, id) {
  return await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first() ?? null;
}
__name(findUserById, "findUserById");
async function createSession(db, options) {
  await db.prepare("INSERT INTO sessions (id, user_id, token_hash, device_label, expires_at) VALUES (?, ?, ?, ?, ?)").bind(options.id, options.userId, options.tokenHash, options.deviceLabel, options.expiresAt).run();
}
__name(createSession, "createSession");
async function findSessionByTokenHash(db, tokenHash) {
  return await db.prepare("SELECT * FROM sessions WHERE token_hash = ?").bind(tokenHash).first() ?? null;
}
__name(findSessionByTokenHash, "findSessionByTokenHash");
async function deleteSessionByTokenHash(db, tokenHash) {
  await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}
__name(deleteSessionByTokenHash, "deleteSessionByTokenHash");
async function createResetToken(db, options) {
  await db.prepare("INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)").bind(options.id, options.userId, options.tokenHash, options.expiresAt).run();
}
__name(createResetToken, "createResetToken");
async function getAllSyncState(db, userId) {
  const { results } = await db.prepare("SELECT collection, data, updated_at, revision FROM sync_state WHERE user_id = ?").bind(userId).all();
  return results;
}
__name(getAllSyncState, "getAllSyncState");
async function putSyncState(db, userId, collection, data, updatedAt, expectedRevision) {
  if (expectedRevision === null) {
    const inserted = await db.prepare(`
      INSERT INTO sync_state (user_id, collection, data, updated_at, revision)
      VALUES (?, ?, ?, ?, 1) ON CONFLICT(user_id, collection) DO NOTHING
      RETURNING revision
    `).bind(userId, collection, data, updatedAt).first();
    return inserted?.revision ?? null;
  }
  const updated = await db.prepare(`
    UPDATE sync_state SET data = ?, updated_at = ?, revision = revision + 1
    WHERE user_id = ? AND collection = ? AND revision = ?
    RETURNING revision
  `).bind(data, updatedAt, userId, collection, expectedRevision).first();
  return updated?.revision ?? null;
}
__name(putSyncState, "putSyncState");
async function completePasswordReset(db, tokenHash, passwordHash, now) {
  const eligible = "SELECT user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND julianday(expires_at) > julianday(?)";
  const results = await db.batch([
    db.prepare(`UPDATE users SET password_hash = ? WHERE id IN (${eligible}) RETURNING id`).bind(passwordHash, tokenHash, now),
    db.prepare("UPDATE password_reset_tokens SET used_at = ? WHERE user_id IN (SELECT id FROM users WHERE password_hash = ?)").bind(now, passwordHash),
    db.prepare("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE password_hash = ?)").bind(passwordHash)
  ]);
  return results[0].results.length === 1;
}
__name(completePasswordReset, "completePasswordReset");
async function completeEmailVerification(db, tokenHash, now) {
  const eligible = "SELECT user_id FROM email_verification_tokens WHERE token_hash = ? AND used_at IS NULL AND julianday(expires_at) > julianday(?)";
  const results = await db.batch([
    db.prepare(`UPDATE users SET email_verified = 1 WHERE id IN (${eligible}) RETURNING id`).bind(tokenHash, now),
    db.prepare("UPDATE email_verification_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND julianday(expires_at) > julianday(?)").bind(now, tokenHash, now)
  ]);
  return results[0].results.length === 1;
}
__name(completeEmailVerification, "completeEmailVerification");
async function createAccountAtomically(db, data) {
  await db.batch([
    db.prepare("INSERT INTO users (id,email,password_hash) VALUES (?,?,?)").bind(data.userId, data.email, data.passwordHash),
    db.prepare("INSERT INTO identities (id,user_id,provider,provider_user_id) VALUES (?,?,'password',?)").bind(crypto.randomUUID(), data.userId, data.email),
    db.prepare("INSERT INTO email_verification_tokens (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)").bind(crypto.randomUUID(), data.userId, data.verificationHash, data.verificationExpires),
    db.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)").bind(crypto.randomUUID(), data.userId, data.sessionHash, data.sessionExpires)
  ]);
}
__name(createAccountAtomically, "createAccountAtomically");

// src/api/auth.ts
var SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
var VERIFY_TTL_MS = 24 * 60 * 60 * 1e3;
var RESET_TTL_MS = 60 * 60 * 1e3;
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function trySendEmail(email, to, message) {
  if (!email) return false;
  try {
    await sendEmail(email, { to, ...message });
    return true;
  } catch (error) {
    console.error(JSON.stringify({ route: "auth", event: "email-delivery-failed" }));
    return false;
  }
}
__name(trySendEmail, "trySendEmail");
async function trySendVerificationEmail(email, to, verificationUrl) {
  if (!email) return false;
  try {
    await sendVerificationEmail(email, to, verificationUrl);
    return true;
  } catch (error) {
    console.error(JSON.stringify({ route: "auth", event: "verification-delivery-failed" }));
    return false;
  }
}
__name(trySendVerificationEmail, "trySendVerificationEmail");
function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 && trimmed.length <= 254 && EMAIL_RE.test(trimmed) ? trimmed : null;
}
__name(normalizeEmail, "normalizeEmail");
function isValidPassword(value) {
  return typeof value === "string" && value.length >= 10 && value.length <= 200 && /[A-Za-z]/.test(value) && /[0-9]/.test(value);
}
__name(isValidPassword, "isValidPassword");
function publicUser(user) {
  return { id: user.id, email: user.email, emailVerified: user.email_verified === 1 };
}
__name(publicUser, "publicUser");
async function issueSession(db, userId, now, deviceLabel) {
  const token = randomToken();
  await createSession(db, {
    id: newId(),
    userId,
    tokenHash: await sha256Hex(token),
    deviceLabel,
    expiresAt: new Date(now() + SESSION_TTL_MS).toISOString()
  });
  return token;
}
__name(issueSession, "issueSession");
async function handleSignup(body, { db, now, email: emailConfig2, verificationUrl }) {
  const record = body;
  const email = normalizeEmail(record?.email);
  if (!email) return { status: 400, body: { error: "Enter a valid email address." } };
  if (!isValidPassword(record?.password)) {
    return { status: 400, body: { error: "Password must be at least 10 characters and include a letter and a number." } };
  }
  if (await findUserByEmail(db, email)) return { status: 409, body: { error: "An account with this email already exists." } };
  const userId = newId();
  const verificationToken = randomToken();
  const sessionToken = randomToken();
  try {
    await createAccountAtomically(db, {
      userId,
      email,
      passwordHash: await hashPassword(record.password),
      verificationHash: await sha256Hex(verificationToken),
      verificationExpires: new Date(now() + VERIFY_TTL_MS).toISOString(),
      sessionHash: await sha256Hex(sessionToken),
      sessionExpires: new Date(now() + SESSION_TTL_MS).toISOString()
    });
  } catch (error) {
    if (await findUserByEmail(db, email)) return { status: 409, body: { error: "An account with this email already exists." } };
    throw error;
  }
  const emailed = await trySendVerificationEmail(emailConfig2, email, verificationUrl(verificationToken));
  return {
    status: 201,
    body: {
      user: { id: userId, email, emailVerified: false },
      sessionToken,
      verificationEmailSent: emailed
    }
  };
}
__name(handleSignup, "handleSignup");
async function handleLogin(body, { db, now }) {
  const record = body;
  const email = normalizeEmail(record?.email);
  const password = record?.password;
  const genericFailure = { status: 401, body: { error: "Incorrect email or password." } };
  if (!email || typeof password !== "string" || !password) return genericFailure;
  const user = await findUserByEmail(db, email);
  if (!user?.password_hash || !await verifyPassword(password, user.password_hash)) return genericFailure;
  const deviceLabel = typeof record.deviceLabel === "string" ? record.deviceLabel.trim().slice(0, 100) || null : null;
  const sessionToken = await issueSession(db, user.id, now, deviceLabel);
  return { status: 200, body: { user: publicUser(user), sessionToken } };
}
__name(handleLogin, "handleLogin");
async function handleLogout(token, { db }) {
  if (token) await deleteSessionByTokenHash(db, await sha256Hex(token));
  return { status: 204, body: null };
}
__name(handleLogout, "handleLogout");
async function resolveSession(token, { db, now }) {
  if (!token) return null;
  const session = await findSessionByTokenHash(db, await sha256Hex(token));
  if (!session || new Date(session.expires_at).getTime() <= now()) return null;
  return findUserById(db, session.user_id);
}
__name(resolveSession, "resolveSession");
async function handleSessionInfo(token, deps) {
  const user = await resolveSession(token, deps);
  if (!user) return { status: 401, body: { error: "Sign in again." } };
  return { status: 200, body: { user: publicUser(user) } };
}
__name(handleSessionInfo, "handleSessionInfo");
async function handleVerifyEmail(body, { db, now }) {
  const token = body?.token;
  if (typeof token !== "string" || !token || token.length > 200) return { status: 400, body: { error: "A verification token is required." } };
  const verified = await completeEmailVerification(db, await sha256Hex(token), new Date(now()).toISOString());
  return verified ? { status: 200, body: { verified: true } } : { status: 400, body: { error: "This verification link is invalid or has expired." } };
}
__name(handleVerifyEmail, "handleVerifyEmail");
async function handleRequestPasswordReset(body, { db, now, email: emailConfig2 }) {
  const email = normalizeEmail(body?.email);
  if (!email) return { status: 400, body: { error: "Enter a valid email address." } };
  const user = await findUserByEmail(db, email);
  if (!user) return { status: 200, body: { requested: true } };
  const resetToken = randomToken();
  await createResetToken(db, {
    id: newId(),
    userId: user.id,
    tokenHash: await sha256Hex(resetToken),
    expiresAt: new Date(now() + RESET_TTL_MS).toISOString()
  });
  await trySendEmail(emailConfig2, email, passwordResetEmail(emailConfig2?.appName ?? "Showtime", resetToken));
  return { status: 200, body: { requested: true } };
}
__name(handleRequestPasswordReset, "handleRequestPasswordReset");
async function handleResetPassword(body, { db, now }) {
  const record = body;
  if (typeof record?.token !== "string" || !record.token || record.token.length > 200) return { status: 400, body: { error: "A reset token is required." } };
  if (!isValidPassword(record.password)) {
    return { status: 400, body: { error: "Password must be at least 10 characters and include a letter and a number." } };
  }
  const reset = await completePasswordReset(db, await sha256Hex(record.token), await hashPassword(record.password), new Date(now()).toISOString());
  if (!reset) return { status: 400, body: { error: "This reset link is invalid or has expired." } };
  return { status: 200, body: { reset: true } };
}
__name(handleResetPassword, "handleResetPassword");

// src/api/sync.ts
var COLLECTIONS = COLLECTION_NAMES;
var MAX_BLOB_BYTES = 2e5;
function isCollection(value) {
  return typeof value === "string" && COLLECTIONS.includes(value);
}
__name(isCollection, "isCollection");
async function handleSyncPull(user, { db, resolveLegacyTitle }) {
  if (user.email_verified !== 1) return { status: 403, body: { error: "Verify your email before syncing." } };
  const rows = await getAllSyncState(db, user.id);
  const collections = {};
  for (const row of rows) {
    try {
      let data = JSON.parse(row.data);
      if (row.collection === "watchlist" && !validateSyncedCollection(row.collection, data)) data = await hydrateLegacyWatchlist(data, resolveLegacyTitle);
      if (!validateSyncedCollection(row.collection, data)) return { status: 500, body: { error: "Stored sync data is unavailable." } };
      collections[row.collection] = { data, updatedAt: row.updated_at, revision: row.revision };
    } catch {
      return { status: 500, body: { error: "Stored sync data is unavailable." } };
    }
  }
  return { status: 200, body: { collections } };
}
__name(handleSyncPull, "handleSyncPull");
async function handleSyncPush(user, body, { db, now }) {
  if (user.email_verified !== 1) return { status: 403, body: { error: "Verify your email before syncing." } };
  const record = body;
  if (!isCollection(record?.collection)) return { status: 400, body: { error: "Unknown collection." } };
  if (record.data === void 0) return { status: 400, body: { error: "Missing data." } };
  if (record.expectedRevision === void 0) {
    return { status: 428, body: { error: "A sync revision is required. Refresh and try again." } };
  }
  if (record.expectedRevision !== null && (!Number.isSafeInteger(record.expectedRevision) || Number(record.expectedRevision) < 1)) {
    return { status: 400, body: { error: "Invalid sync revision." } };
  }
  const serialized = JSON.stringify(record.data);
  if (new TextEncoder().encode(serialized).byteLength > MAX_BLOB_BYTES) {
    return { status: 413, body: { error: "Data is too large to sync." } };
  }
  if (!validateSyncedCollection(record.collection, record.data)) return { status: 400, body: { error: "Invalid collection data." } };
  const updatedAt = new Date(now()).toISOString();
  const revision = await putSyncState(db, user.id, record.collection, serialized, updatedAt, record.expectedRevision);
  if (revision === null) return { status: 409, body: { error: "Sync conflict. Pull the latest data and retry." } };
  return { status: 200, body: { collection: record.collection, updatedAt, revision } };
}
__name(handleSyncPush, "handleSyncPush");

// src/account-routes.ts
var AUTH_BODY_BYTES = 2e4;
var SYNC_DATA_BYTES = 2e5;
var SYNC_ENVELOPE_BYTES = SYNC_DATA_BYTES + 4096;
function isAccountPath(pathname) {
  return pathname.startsWith("/auth/") || pathname.startsWith("/sync/");
}
__name(isAccountPath, "isAccountPath");
function bearerToken(request) {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 && token.length <= 200 ? token : null;
}
__name(bearerToken, "bearerToken");
async function readJsonBody(request) {
  const budget = new URL(request.url).pathname === "/sync/push" ? SYNC_ENVELOPE_BYTES : AUTH_BODY_BYTES;
  const declared = request.headers.get("Content-Length");
  const tooLarge = { ok: false, status: 413, error: "Request body is too large." };
  if (declared && /^\d+$/.test(declared) && Number(declared) > budget) return tooLarge;
  if (!request.body) return { ok: true, value: {} };
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text2 = "", size = 0;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1e4);
  const signal = controller.signal;
  try {
    while (true) {
      const read = reader.read();
      const chunk = await new Promise((resolve, reject) => {
        const abort = /* @__PURE__ */ __name(() => reject(new Error("Request body timed out")), "abort");
        signal.addEventListener("abort", abort, { once: true });
        read.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
        if (signal.aborted) abort();
      });
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > budget) {
        void reader.cancel().catch(() => {
        });
        return tooLarge;
      }
      text2 += decoder.decode(chunk.value, { stream: true });
    }
    text2 += decoder.decode();
  } catch {
    void reader.cancel().catch(() => {
    });
    return { ok: false, status: 408, error: "Request body could not be read. Please retry." };
  } finally {
    clearTimeout(timeout);
    try {
      reader.releaseLock();
    } catch {
    }
  }
  if (!text2) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(text2) };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON body." };
  }
}
__name(readJsonBody, "readJsonBody");
async function handleAccountRequest(request, db, email, resolveLegacyTitle) {
  const url = new URL(request.url);
  const { pathname } = url;
  const { method } = request;
  const deps = {
    db,
    resolveLegacyTitle,
    now: Date.now,
    email,
    verificationUrl: /* @__PURE__ */ __name((token) => {
      const verificationUrl = new URL("/auth/verify-email", url.origin);
      verificationUrl.searchParams.set("token", token);
      return verificationUrl.toString();
    }, "verificationUrl")
  };
  if (pathname === "/auth/signup" && method === "POST") {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return { status: parsed.status, body: { error: parsed.error } };
    return handleSignup(parsed.value, deps);
  }
  if (pathname === "/auth/login" && method === "POST") {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return { status: parsed.status, body: { error: parsed.error } };
    return handleLogin(parsed.value, deps);
  }
  if (pathname === "/auth/logout" && method === "POST") return handleLogout(bearerToken(request), deps);
  if (pathname === "/auth/session" && method === "GET") return handleSessionInfo(bearerToken(request), deps);
  if (pathname === "/auth/verify-email" && method === "POST") {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return { status: parsed.status, body: { error: parsed.error } };
    return handleVerifyEmail(parsed.value, deps);
  }
  if (pathname === "/auth/request-reset" && method === "POST") {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return { status: parsed.status, body: { error: parsed.error } };
    return handleRequestPasswordReset(parsed.value, deps);
  }
  if (pathname === "/auth/reset-password" && method === "POST") {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return { status: parsed.status, body: { error: parsed.error } };
    return handleResetPassword(parsed.value, deps);
  }
  if (pathname === "/sync/pull" && method === "GET") {
    const user = await resolveSession(bearerToken(request), deps);
    if (!user) return { status: 401, body: { error: "Sign in again." } };
    return handleSyncPull(user, deps);
  }
  if (pathname === "/sync/push" && method === "POST") {
    const user = await resolveSession(bearerToken(request), deps);
    if (!user) return { status: 401, body: { error: "Sign in again." } };
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return { status: parsed.status, body: { error: parsed.error } };
    return handleSyncPush(user, parsed.value, deps);
  }
  return { status: 404, body: { error: "Not found." } };
}
__name(handleAccountRequest, "handleAccountRequest");

// src/index.ts
function emailConfig(env) {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return null;
  return {
    apiKey,
    from,
    appName: env.APP_NAME?.trim() || "Showtime",
    verificationTemplateId: env.RESEND_VERIFICATION_TEMPLATE_ID?.trim() || void 0
  };
}
__name(emailConfig, "emailConfig");
function verificationRedirect(appUrl, verified) {
  const destination = new URL("/account", appUrl?.trim() || "https://showtimetracker.show");
  destination.searchParams.set("verification", verified ? "success" : "invalid");
  return new Response(null, {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
      Location: destination.toString(),
      "Referrer-Policy": "no-referrer"
    }
  });
}
__name(verificationRedirect, "verificationRedirect");
function routeName(kind) {
  if (kind === "search" || kind === "discovery" || kind === "movie-details" || kind === "tv-details" || kind === "season-details" || kind === "person-details" || kind === "tv-schedule" || kind === "tv-summary") return kind;
  return "unmatched";
}
__name(routeName, "routeName");
var index_default = {
  async fetch(request, env, executionContext) {
    const requestId = crypto.randomUUID();
    const startedAt = performance.now();
    const origin = request.headers.get("Origin");
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
    let route = "unmatched";
    let status = 500;
    let cacheOutcome = "bypass";
    const finish = /* @__PURE__ */ __name((response) => {
      status = response.status;
      logEvent({
        requestId,
        route,
        status,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
        cache: cacheOutcome
      });
      return response;
    }, "finish");
    const securityHeaders = corsHeaders(origin, allowedOrigins);
    try {
      if (!isAllowedOrigin(origin, allowedOrigins)) {
        return finish(jsonResponse(403, { error: "Origin is not allowed." }, requestId, securityHeaders));
      }
      let pathname = "";
      try {
        pathname = new URL(request.url).pathname;
      } catch {
      }
      const clientKey = request.headers.get("CF-Connecting-IP")?.trim() || "anonymous";
      if (isAccountPath(pathname)) {
        route = pathname.startsWith("/auth/") ? "auth" : "sync";
        if (request.method === "OPTIONS") {
          const headers = new Headers(securityHeaders);
          for (const [key, value] of accountPreflightHeaders()) headers.set(key, value);
          return finish(jsonResponse(204, null, requestId, headers));
        }
        const limiter = pathname.startsWith("/auth/") ? env.AUTH_LIMITER : env.SYNC_LIMITER;
        if (limiter && !(await limiter.limit({ key: clientKey })).success) {
          return finish(jsonResponse(429, { error: "Please wait a moment and try again." }, requestId, securityHeaders));
        }
        if (!env.SHOWTIME_DB) {
          return finish(jsonResponse(503, { error: "Accounts are not configured yet." }, requestId, securityHeaders));
        }
        if (pathname === "/auth/verify-email" && request.method === "GET") {
          const result3 = await handleAccountRequest(
            new Request(request.url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: new URL(request.url).searchParams.get("token") })
            }),
            env.SHOWTIME_DB,
            emailConfig(env)
          );
          return finish(verificationRedirect(env.APP_URL, result3.status === 200));
        }
        const resolveLegacyTitle = createLegacyTitleResolver({
          token: env.TMDB_READ_ACCESS_TOKEN,
          charge: /* @__PURE__ */ __name(() => enforceRateLimits({ kind: "tv-summary", cost: 1 }, env, clientKey), "charge"),
          read: fetchTmdbJson
        });
        const result2 = await handleAccountRequest(request, env.SHOWTIME_DB, emailConfig(env), resolveLegacyTitle);
        return finish(jsonResponse(result2.status, result2.body, requestId, securityHeaders));
      }
      const parsed = parseApiRequest({ method: request.method, url: request.url });
      if (!parsed.ok) {
        const headers = new Headers(securityHeaders);
        if ("allow" in parsed && parsed.allow) headers.set("Allow", parsed.allow);
        return finish(jsonResponse(parsed.status, parsed.body, requestId, headers));
      }
      if (parsed.route.kind === "options") {
        const headers = new Headers(securityHeaders);
        for (const [key, value] of preflightHeaders()) headers.set(key, value);
        return finish(jsonResponse(204, null, requestId, headers));
      }
      route = routeName(parsed.route.kind);
      if (!env.TMDB_READ_ACCESS_TOKEN?.trim()) {
        return finish(jsonResponse(503, { error: "The API is not configured yet." }, requestId, securityHeaders));
      }
      if (!await enforceRateLimits({ ...parsed.route, cost: 0 }, env, clientKey)) {
        return finish(jsonResponse(429, { error: "Please wait a moment and try again." }, requestId, securityHeaders));
      }
      const deps = {
        token: env.TMDB_READ_ACCESS_TOKEN,
        fetchTmdbJson,
        optionalTimeoutMs: 3e3,
        log: /* @__PURE__ */ __name((event) => logUpstream({ requestId, route, status: event.status, durationMs: event.durationMs }), "log")
      };
      const load = /* @__PURE__ */ __name(async () => {
        if (!await enforceRateLimits(parsed.route, env, clientKey, { category: false })) {
          return { status: 429, body: { error: "Please wait a moment and try again." } };
        }
        if (parsed.route.kind === "tv-summary") return handleSummary(parsed.route, deps);
        if (parsed.route.kind === "search") return handleSearch(parsed.route, deps);
        if (parsed.route.kind === "discovery") return handleDiscovery(parsed.route, deps);
        if (parsed.route.kind === "tv-schedule") return handleSchedule(parsed.route, deps);
        return handleDetails(parsed.route, deps);
      }, "load");
      const cached = executionContext ? await withApiCache({ ...parsed.route, namespace: env.CACHE_NAMESPACE }, caches.default, load, executionContext) : { result: await load(), outcome: "bypass" };
      cacheOutcome = cached.outcome;
      const { result } = cached;
      return finish(jsonResponse(result.status, result.body, requestId, securityHeaders));
    } catch {
      return finish(jsonResponse(503, { error: "The service is temporarily unavailable. Please try again." }, requestId, securityHeaders));
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map


export {parseApiRequest,fetchTmdbJson,handleSchedule,withApiCache};
