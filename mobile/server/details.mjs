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

async function loadLatestSeason({ tvId, season, token, fetchImpl }) {
  if (!season) return null;
  try {
    const upstream = await fetchImpl(
      `https://api.themoviedb.org/3/tv/${tvId}/season/${season.seasonNumber}`,
      {
        headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!upstream.ok) return null;
    const data = await upstream.json();
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
  } catch {
    return null;
  }
}

export async function handleDetails({ pathname, method, token, fetchImpl, send }) {
  if (method !== 'GET') return send(405, { error: 'Use GET.' });
  const match = /^\/details\/(movie|tv)\/([1-9]\d*)$/.exec(pathname);
  if (!match || !Number.isSafeInteger(Number(match[2]))) {
    return send(400, { error: 'Choose a valid movie or TV title.' });
  }
  if (!token) return send(503, { error: 'Details are not configured yet.' });
  const [, mediaType, id] = match;

  try {
    const upstream = await fetchImpl(`https://api.themoviedb.org/3/${mediaType}/${id}?append_to_response=credits,videos`, {
      headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
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
    const latestSeason = movie ? null : await loadLatestSeason({
      tvId: data.id,
      season: latestSeasonSummary,
      token,
      fetchImpl,
    });
    send(200, { details: {
      ...mapExtras(data),
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
