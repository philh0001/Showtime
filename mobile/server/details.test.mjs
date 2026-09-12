import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { createSearchHandler } from './search.mjs';

async function request(t, path, fetchImpl, method = 'GET') {
  const server = createServer(createSearchHandler({ token: 'private-test-token', fetchImpl }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  return fetch(`http://127.0.0.1:${server.address().port}${path}`, { method });
}

test('movie details use the movie endpoint and return only display fields', async (t) => {
  const response = await request(t, '/details/movie/272', async (url, options) => {
    if (String(url) !== 'https://api.themoviedb.org/3/movie/272'
      || options.headers.Authorization !== 'Bearer private-test-token') return new Response(null, { status: 401 });
    return Response.json({ id: 272, title: 'Batman Begins', overview: 'A new beginning.',
      release_date: '2005-06-10', vote_average: 7.7, vote_count: 150,
      poster_path: '/poster.jpg', backdrop_path: '/backdrop.jpg',
      genres: [{ id: 28, name: 'Action' }], private_field: 'must-not-return' });
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { details: {
    id: 272, mediaType: 'Movie', title: 'Batman Begins', overview: 'A new beginning.',
    releaseDate: '2005-06-10', rating: 7.7, genres: ['Action'],
    posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/w780/backdrop.jpg', seasons: [],
  } });
});

test('TV details use TV names/dates and retain specials and season summaries', async (t) => {
  const response = await request(t, '/details/tv/1396', async (url) => {
    if (String(url) !== 'https://api.themoviedb.org/3/tv/1396') return new Response(null, { status: 404 });
    return Response.json({ id: 1396, name: 'Breaking Bad', first_air_date: '2008-01-20',
      overview: 'A chemistry teacher changes course.', vote_average: 8.9, vote_count: 200,
      genres: [{ id: 18, name: 'Drama' }], seasons: [
        { id: 2, name: 'Season 1', season_number: 1, episode_count: 7, air_date: '2008-01-20' },
        { id: 1, name: 'Specials', season_number: 0, episode_count: 3, air_date: null },
      ] });
  });
  assert.equal(response.status, 200);
  const { details } = await response.json();
  assert.equal(details.title, 'Breaking Bad');
  assert.equal(details.releaseDate, '2008-01-20');
  assert.equal(details.mediaType, 'TV');
  assert.deepEqual(details.seasons, [
    { id: 1, name: 'Specials', seasonNumber: 0, episodeCount: 3, airDate: null },
    { id: 2, name: 'Season 1', seasonNumber: 1, episodeCount: 7, airDate: '2008-01-20' },
  ]);
});

test('missing metadata stays empty and unrated is not presented as zero', async (t) => {
  const response = await request(t, '/details/movie/2', async () => Response.json({
    id: 2, title: '', release_date: '', poster_path: null, backdrop_path: null,
    vote_average: 0, vote_count: 0, genres: null,
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { details: {
    id: 2, mediaType: 'Movie', title: 'Untitled', releaseDate: null, overview: null,
    posterUrl: null, backdropUrl: null, rating: null, genres: [], seasons: [],
  } });
});

test('rejects invalid IDs/types and POST before contacting TMDB', async (t) => {
  let calls = 0;
  const upstream = async () => { calls++; return Response.json({ id: 1 }); };
  for (const path of ['/details/person/1', '/details/movie/0', '/details/tv/nope', '/details/movie/99999999999999999', '/details/movie/1/credits']) {
    assert.equal((await request(t, path, upstream)).status, 400);
  }
  assert.equal((await request(t, '/details/movie/1', upstream, 'POST')).status, 405);
  assert.equal(calls, 0);
});

test('not-found, rate-limit and authorization failures return safe detail errors', async (t) => {
  for (const [upstreamStatus, expectedStatus] of [[404, 404], [429, 429], [401, 502]]) {
    const response = await request(t, '/details/movie/1', async () => new Response('private-test-token', { status: upstreamStatus }));
    assert.equal(response.status, expectedStatus);
    const body = await response.json();
    assert.equal(typeof body.error, 'string');
    assert.equal(JSON.stringify(body).includes('private-test-token'), false);
  }
});

test('network errors and malformed detail responses fail safely', async (t) => {
  for (const fetchImpl of [
    async () => { throw new Error('private-test-token'); },
    async () => Response.json({ success: false }),
    async () => Response.json({ id: 999 }),
  ]) {
    const response = await request(t, '/details/movie/1', fetchImpl);
    assert.equal(response.status, 502);
    assert.equal((await response.text()).includes('private-test-token'), false);
  }
});
