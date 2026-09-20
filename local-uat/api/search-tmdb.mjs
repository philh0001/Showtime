// Run with Node on your computer; never import this script into the app.
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

async function main() {
  try {
    loadEnvFile(fileURLToPath(new URL('../.env.local', import.meta.url)));
  } catch {
    console.error('Create local-uat/.env.local from local-uat/.env.example first.');
    process.exitCode = 1;
    return;
  }

  const token = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
  if (!token) {
    console.error('Add TMDB_READ_ACCESS_TOKEN to local-uat/.env.local.');
    process.exitCode = 1;
    return;
  }

  const query = process.argv.slice(2).join(' ').trim();
  if (!query) {
    console.error('Supply a title: npm run local:tmdb -- "Batman"');
    process.exitCode = 1;
    return;
  }

  // URLSearchParams safely encodes spaces and punctuation in the title.
  const url = new URL('https://api.themoviedb.org/3/search/multi');
  url.search = new URLSearchParams({ query, include_adult: 'false', page: '1' }).toString();

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  console.log(`TMDB HTTP status: ${response.status}`);
  if (!response.ok) {
    const hint = response.status === 401
      ? 'Check the API Read Access Token in .env.local (without a Bearer prefix).'
      : response.status === 429
        ? 'Too many requests. Wait before trying again.'
        : 'TMDB rejected the request. Check service availability and try again.';
    console.error(hint);
    process.exitCode = 1;
    return;
  }

  const data = await response.json();
  if (!Array.isArray(data.results)) throw new Error('Unexpected response');

  // Multi-search includes people. Keep only movies and TV shows.
  const results = data.results
    .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
    .map((item) => {
      const movie = item.media_type === 'movie';
      const date = movie ? item.release_date : item.first_air_date;
      return {
        title: (movie ? item.title : item.name) || 'Untitled',
        year: typeof date === 'string' && /^\d{4}-/.test(date)
          ? date.slice(0, 4) : 'Year unknown',
        type: movie ? 'Movie' : 'TV',
        poster: item.poster_path
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'No poster',
      };
    });

  console.log('Movie and TV matches from page 1:');
  if (results.length) console.table(results);
  else console.log('No movie or TV matches on this page.');
}

main().catch(() => {
  // Never print request headers, environment values or raw error objects.
  console.error('Search failed: check your connection and try again. The request may have timed out or returned an invalid response.');
  process.exitCode = 1;
});
