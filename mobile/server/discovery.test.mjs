import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { createSearchHandler } from './search.mjs';

async function serverFor(t, fetchImpl) {
  const server = createServer(createSearchHandler({ token: 'secret-test-token', fetchImpl }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}/discovery`;
}

test('discovery returns bounded, validated movie and TV snapshots and shares cached requests', async (t) => {
  const calls = [];
  const url = await serverFor(t, async (upstream, options) => {
    calls.push(String(upstream));
    assert.equal(options.headers.Authorization, 'Bearer secret-test-token');
    const movie = String(upstream).includes('/movie/');
    return Response.json({ results: [
      { id: 1, title: 'Movie', name: 'Show', release_date: '2026-01-02', first_air_date: '2025-01-01', poster_path: '/poster.jpg' },
      { id: 1, title: 'Duplicate', name: 'Duplicate' },
      { id: -2, title: 'Invalid' }, { id: 3, title: 'Adult', name: 'Adult', adult: true },
      { id: 4, title: movie ? 'Fallback' : undefined, name: 'Fallback', poster_path: '//other.example/image' },
    ] });
  });
  const [first, second] = await Promise.all([fetch(url), fetch(url)]);
  assert.equal(first.status, 200);
  const data = await first.json();
  assert.deepEqual(data.movies, [
    { id: 1, title: 'Movie', mediaType: 'Movie', year: '2026', posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg' },
    { id: 4, title: 'Fallback', mediaType: 'Movie', year: null, posterUrl: null },
  ]);
  assert.equal(data.tv[0].mediaType, 'TV');
  assert.deepEqual(await second.json(), data);
  await fetch(url);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((value) => value.endsWith('/week?language=en-GB')));
});

test('failed discovery requests are safe and can be retried', async (t) => {
  let fail = true;
  const url = await serverFor(t, async () => {
    if (fail) throw new Error('secret-test-token');
    return Response.json({ results: [] });
  });
  const response = await fetch(url);
  assert.equal(response.status, 502);
  assert.equal((await response.text()).includes('secret-test-token'), false);
  fail = false;
  assert.equal((await fetch(url)).status, 200);
  assert.equal((await fetch(url, { method: 'POST' })).status, 405);
});
