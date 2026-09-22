function mapSearchResults(results) {
  return results
    .filter((item) => item && Number.isInteger(item.id) && ['movie', 'tv'].includes(item.media_type))
    .map((item) => {
      const movie = item.media_type === 'movie';
      const date = movie ? item.release_date : item.first_air_date;
      const title = movie ? item.title : item.name;
      return {
        id: `${item.media_type}-${item.id}`,
        title: typeof title === 'string' && title.trim() ? title : 'Untitled',
        year: typeof date === 'string' && /^\d{4}-/.test(date) ? date.slice(0, 4) : null,
        mediaType: movie ? 'Movie' : 'TV',
        posterUrl: typeof item.poster_path === 'string' && /^\/[\w.-]+$/.test(item.poster_path)
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
          : null,
      };
    });
}

function mapSearchError(error) {
  if (error?.kind === 'throttled') {
    return { status: 429, body: { error: 'Please wait a moment before searching again.' } };
  }
  if (error?.kind === 'timeout') {
    return { status: 502, body: { error: 'Could not reach the search service. Please try again.' } };
  }
  if (error?.kind === 'upstream' && error.status === 0) {
    return { status: 502, body: { error: 'Could not reach the search service. Please try again.' } };
  }
  if (['not-found', 'upstream', 'invalid-body', 'too-large'].includes(error?.kind)) {
    return { status: 502, body: { error: 'Search is temporarily unavailable. Please try again.' } };
  }
  return { status: 502, body: { error: 'Could not reach the search service. Please try again.' } };
}

export async function handleSearch(route, { token, fetchTmdbJson }) {
  if (!token) return { status: 503, body: { error: 'Search is not configured yet.' } };

  try {
    const query = new URLSearchParams({
      query: route.query,
      include_adult: 'false',
      page: '1',
    });
    const data = await fetchTmdbJson({
      endpoint: `/3/search/multi?${query}`,
      route: 'search',
      token,
    });
    if (!Array.isArray(data?.results)) throw new TypeError('Invalid search response');
    return { status: 200, body: { results: mapSearchResults(data.results) } };
  } catch (error) {
    return mapSearchError(error);
  }
}
