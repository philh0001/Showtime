// Server-only. Cache the public lists, never credentials or upstream errors.
export function createDiscoveryHandler({ token, fetchImpl = fetch, now = Date.now }) {
  let cached = null;
  let expiresAt = 0;
  let pending = null;

  async function fetchList(type) {
    const response = await fetchImpl(`https://api.themoviedb.org/3/trending/${type}/week?language=en-GB`, {
      headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Discovery unavailable');
    const data = await response.json();
    if (!Array.isArray(data?.results)) throw new Error('Invalid discovery');
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
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      });
      if (items.size === 20) break;
    }
    return [...items.values()];
  }

  return async ({ method, send }) => {
    if (method !== 'GET') return send(405, { error: 'Use GET.' });
    if (!token) return send(503, { error: 'Discovery is not configured yet.' });
    try {
      if (!cached || now() >= expiresAt) {
        pending ??= Promise.all([fetchList('movie'), fetchList('tv')])
          .then(([movies, tv]) => {
            cached = { movies, tv };
            expiresAt = now() + 30 * 60 * 1000;
            return cached;
          }).finally(() => { pending = null; });
        await pending;
      }
      return send(200, cached);
    } catch {
      return send(502, { error: 'Discovery is temporarily unavailable. Please try again.' });
    }
  };
}
