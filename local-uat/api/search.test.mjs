import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer, request as httpRequest } from 'node:http';
import { createSearchHandler } from './search.mjs';

async function request(t, fetchImpl, path = '/search?query=Batman', method = 'GET') {
  const server = createServer(createSearchHandler({
    token: 'private-test-token',
    fetchImpl,
    logger: { info() {} },
  }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  return fetch(`http://127.0.0.1:${server.address().port}${path}`, { method });
}

async function rawRequest(t, path) {
  const server = createServer(createSearchHandler({
    token: 'private-test-token',
    fetchImpl: () => { throw new Error('Should not fetch'); },
    logger: { info() {} },
  }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  return new Promise((resolve, reject) => {
    const outgoing = httpRequest({
      host: '127.0.0.1',
      port: server.address().port,
      method: 'GET',
      path,
    }, (response) => {
      response.resume();
      response.once('end', () => resolve(response.statusCode));
    });
    outgoing.once('error', reject);
    outgoing.end();
  });
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
  assert.deepEqual(await response.json(), {
    error: 'Search is temporarily unavailable. Please try again.',
  });
});

test('network exceptions become a safe error', async (t) => {
  const response = await request(t, async () => { throw new Error('private-test-token'); });
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: 'Could not reach the search service. Please try again.',
  });
});

test('only the search route and GET method are accepted', async (t) => {
  assert.equal((await request(t, fetch, '/other')).status, 404);
  assert.equal((await request(t, fetch, '/search?query=Batman', 'POST')).status, 405);
  assert.equal((await request(t, fetch, '/search?query=Batman&query=Robin')).status, 400);
});

test('rejects raw noncanonical search paths before URL normalization', async (t) => {
  assert.equal(await rawRequest(t, '/other/../search?query=Batman'), 404);
  assert.equal(await rawRequest(t, '/other\\..\\search?query=Batman'), 404);
});

test('serves saved-show schedule metadata through the shared route', async (t) => {
  const calls = [];
  const response = await request(t, async (url) => {
    calls.push(String(url));
    if (String(url).includes('/season/1')) return Response.json({
      id: 8, season_number: 1,
      episodes: [{ id: 9, season_number: 1, episode_number: 1,
        air_date: '2099-01-02', name: 'Pilot' }],
    });
    return Response.json({ id: 123, name: 'Example', seasons: [
      { id: 8, season_number: 1, episode_count: 1 },
    ] });
  }, '/schedule/tv/123');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.schedule.episodes[0].airDate, '2099-01-02');
  assert.equal(calls.length, 2);
});

test('rejects invalid schedule paths before contacting TMDB', async (t) => {
  const response = await request(t, () => { throw new Error('Should not fetch'); }, '/schedule/tv/0');
  assert.equal(response.status, 400);
});
