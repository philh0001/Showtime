// This file runs only on the computer/server, never in the mobile bundle.
const imageUrl = (path, size) => typeof path === 'string' && /^\/[\w.-]+$/.test(path)
  ? `https://image.tmdb.org/t/p/${size}${path}` : null;
const textOrNull = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const dateOrNull = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

export async function handleDetails({ pathname, method, token, fetchImpl, send }) {
  if (method !== 'GET') return send(405, { error: 'Use GET.' });
  const match = /^\/details\/(movie|tv)\/([1-9]\d*)$/.exec(pathname);
  if (!match || !Number.isSafeInteger(Number(match[2]))) {
    return send(400, { error: 'Choose a valid movie or TV title.' });
  }
  if (!token) return send(503, { error: 'Details are not configured yet.' });
  const [, mediaType, id] = match;

  try {
    const upstream = await fetchImpl(`https://api.themoviedb.org/3/${mediaType}/${id}`, {
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
    send(200, { details: {
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
    } });
  } catch {
    // Do not forward TMDB bodies, credentials or raw network errors.
    send(502, { error: 'Could not load details. Please try again.' });
  }
}
