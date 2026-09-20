function mapDiscoveryList(data, type) {
  if (!Array.isArray(data?.results)) throw new TypeError('Invalid discovery response');
  const items = new Map();
  for (const item of data.results) {
    if (!item || !Number.isSafeInteger(item.id) || item.id <= 0 || item.adult === true || items.has(item.id)) continue;
    const movie = type === 'movie';
    const title = movie ? item.title : item.name;
    if (typeof title !== 'string' || !title.trim()) continue;
    const date = movie ? item.release_date : item.first_air_date;
    items.set(item.id, {
      id: item.id,
      title: title.trim(),
      mediaType: movie ? 'Movie' : 'TV',
      year: typeof date === 'string' && /^\d{4}-/.test(date) ? date.slice(0, 4) : null,
      posterUrl: typeof item.poster_path === 'string' && /^\/[\w.-]+$/.test(item.poster_path)
        ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
        : null,
    });
    if (items.size === 20) break;
  }
  return [...items.values()];
}

export async function handleDiscovery(_route, { token, fetchTmdbJson }) {
  if (!token) return { status: 503, body: { error: 'Discovery is not configured yet.' } };
  try {
    const [movies, tv] = await Promise.all([
      fetchTmdbJson({ endpoint: '/3/trending/movie/week?language=en-GB', route: 'discovery', token }),
      fetchTmdbJson({ endpoint: '/3/trending/tv/week?language=en-GB', route: 'discovery', token }),
    ]);
    return {
      status: 200,
      body: {
        movies: mapDiscoveryList(movies, 'movie'),
        tv: mapDiscoveryList(tv, 'tv'),
      },
    };
  } catch {
    return {
      status: 502,
      body: { error: 'Discovery is temporarily unavailable. Please try again.' },
    };
  }
}
