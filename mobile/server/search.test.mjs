import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { createSearchHandler } from './search.mjs';

async function request(t, fetchImpl, path = '/search?query=Batman', method = 'GET') {
  const server = createServer(createSearchHandler({ token: 'private-test-token', fetchImpl }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  return fetch(`http://127.0.0.1:${server.address().port}${path}`, { method });
}

test('returns movie/TV display fields, excludes people, and handles missing artwork/dates', async (t) => {
  const response = await request(t, async () => Response.json({ results: [
    { id: 1, media_type: 'person', name: 'Actor' },
    { id: 2, media_type: 'movie', title: 'Batman', release_date: '1989-06-23', poster_path: '/poster.jpg' },
    { id: 2, media_type: 'tv', name: 'Batman', first_air_date: '', poster_path: null },
  ] }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { results: [
    { id: 'movie-2', title: 'Batman', year: '1989', mediaType: 'Movie', posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg' },
    { id: 'tv-2', title: 'Batman', year: null, mediaType: 'TV', posterUrl: null },
  ] });
});

test('rejects blank searches without contacting TMDB', async (t) => {
  const response = await request(t, () => { throw new Error('Should not fetch'); }, '/search?query=%20');
  assert.equal(response.status, 400);
});

test('upstream errors cannot leak credentials or response bodies', async (t) => {
  const response = await request(t, async () => new Response('private-test-token', { status: 401 }));
  assert.equal(response.status, 502);
  assert.equal((await response.text()).includes('private-test-token'), false);
});

test('network exceptions become a safe error', async (t) => {
  const response = await request(t, async () => { throw new Error('private-test-token'); });
  assert.equal(response.status, 502);
  assert.equal((await response.text()).includes('private-test-token'), false);
});

test('only the search route and GET method are accepted', async (t) => {
  assert.equal((await request(t, fetch, '/other')).status, 404);
  assert.equal((await request(t, fetch, '/search?query=Batman', 'POST')).status, 405);
});
