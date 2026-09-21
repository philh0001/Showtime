const MAX_SEASONS = 12;
const MAX_EPISODES = 200;
const MAX_SEASON_SUMMARIES = 100;

const textOrNull = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const imageUrl = (path) => typeof path === 'string' && /^\/[\w.-]+$/.test(path)
  ? `https://image.tmdb.org/t/p/w500${path}` : null;

function dateOrNull(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day ? value : null;
}

function episodeOrNull(value, seasonNumber, cutoff) {
  if (!value || !Number.isSafeInteger(value.id) || value.id <= 0
    || value.season_number !== seasonNumber
    || !Number.isSafeInteger(value.episode_number) || value.episode_number <= 0) return null;
  const airDate = dateOrNull(value.air_date);
  if (!airDate || airDate < cutoff) return null;
  return {
    id: value.id,
    name: textOrNull(value.name),
    seasonNumber,
    episodeNumber: value.episode_number,
    airDate,
  };
}

function validSeasons(value) {
  if (!Array.isArray(value)) return null;
  const byNumber = new Map();
  for (const season of value) {
    if (!season || !Number.isSafeInteger(season.season_number) || season.season_number < 0) return null;
    if (season.season_number === 0) continue;
    if (!Number.isSafeInteger(season.id) || season.id <= 0
      || !Number.isSafeInteger(season.episode_count) || season.episode_count < 0) return null;
    if (season.episode_count === 0) continue;
    byNumber.set(season.season_number, { id: season.id, number: season.season_number });
    if (byNumber.size > MAX_SEASON_SUMMARIES) return null;
  }
  return [...byNumber.values()].sort((a, b) => b.number - a.number);
}

async function fetchSeason(route, deps, season, cutoff) {
  try {
    const data = await deps.fetchTmdbJson({
      endpoint: `/3/tv/${route.id}/season/${season.number}`,
      route: route.kind,
      token: deps.token,
      ...(deps.log ? { log: deps.log } : {}),
    });
    if (!data || data.id !== season.id || data.season_number !== season.number
      || !Array.isArray(data.episodes)) return null;
    return data.episodes.map((item) => episodeOrNull(item, season.number, cutoff)).filter(Boolean);
  } catch {
    return null;
  }
}

function uniqueSortedEpisodes(episodes) {
  const byId = new Set();
  const bySlot = new Set();
  return episodes.sort((a, b) => a.airDate.localeCompare(b.airDate)
    || a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber || a.id - b.id)
    .filter((item) => {
      const slot = `${item.seasonNumber}:${item.episodeNumber}`;
      if (byId.has(item.id) || bySlot.has(slot)) return false;
      byId.add(item.id);
      bySlot.add(slot);
      return true;
    });
}

/**
 * @param {{ kind: string, id?: number }} route
 * @param {{ token?: string, fetchTmdbJson?: (options: any) => Promise<any>, now?: Date, log?: (event: any) => void }} deps
 */
export async function handleSchedule(route, { token, fetchTmdbJson, now = new Date(), log } = {}) {
  if (!token) return { status: 503, body: { error: 'Schedule is not configured yet.' } };
  if (route?.kind !== 'tv-schedule' || !Number.isSafeInteger(route.id) || route.id <= 0
    || typeof fetchTmdbJson !== 'function') {
    return { status: 502, body: { error: 'Could not load schedule. Please try again.' } };
  }

  const cutoffDate = new Date(now);
  cutoffDate.setUTCHours(0, 0, 0, 0);
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 2);
  const cutoff = cutoffDate.toISOString().slice(0, 10);
  let summary;
  try {
    summary = await fetchTmdbJson({
      endpoint: `/3/tv/${route.id}`, route: route.kind, token,
      ...(log ? { log } : {}),
    });
  } catch (error) {
    const status = error?.kind === 'not-found' ? 404 : error?.kind === 'throttled' ? 429 : 502;
    return { status, body: { error: status === 404 ? 'This TV show could not be found.'
      : status === 429 ? 'Please wait a moment and try again.'
        : 'Could not load schedule. Please try again.' } };
  }
  const title = textOrNull(summary?.name);
  const seasons = validSeasons(summary?.seasons);
  if (summary?.id !== route.id || !title || !seasons) {
    return { status: 502, body: { error: 'Could not load schedule. Please try again.' } };
  }

  const selected = seasons.slice(0, MAX_SEASONS);
  const results = new Array(selected.length);
  let cursor = 0;
  async function worker() {
    while (cursor < selected.length) {
      const index = cursor++;
      results[index] = await fetchSeason(route, { token, fetchTmdbJson, log }, selected[index], cutoff);
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, selected.length) }, () => worker()));

  const seasonCoverage = new Map(seasons.map((season) => [season.number, 'limited']));
  const allEpisodes = [];
  selected.forEach((season, index) => {
    seasonCoverage.set(season.number, results[index] === null ? 'unavailable' : 'checked');
    if (results[index]) allEpisodes.push(...results[index]);
  });
  const sorted = uniqueSortedEpisodes(allEpisodes);
  for (const item of sorted.slice(MAX_EPISODES)) seasonCoverage.set(item.seasonNumber, 'limited');
  const coverage = [...seasonCoverage.values()].every((status) => status === 'checked')
    ? 'complete' : 'partial';

  const nextValue = summary.next_episode_to_air;
  const nextEpisode = nextValue && Number.isSafeInteger(nextValue.season_number)
    && nextValue.season_number > 0
    && seasonCoverage.get(nextValue.season_number) !== 'checked'
    ? episodeOrNull(nextValue, nextValue.season_number, cutoff) : null;
  return { status: 200, body: { schedule: {
    id: route.id,
    title,
    posterUrl: imageUrl(summary.poster_path),
    episodes: sorted.slice(0, MAX_EPISODES),
    seasonCoverage: [...seasonCoverage].sort(([a], [b]) => a - b)
      .map(([seasonNumber, status]) => ({ seasonNumber, status })),
    coverage,
    nextEpisode,
  } } };
}
