import assert from 'node:assert/strict';
import test from 'node:test';

import { handleDiscovery } from './discovery.mjs';
import { TmdbError } from './tmdb.mjs';

const route = Object.freeze({ kind: 'discovery', cacheKey: '/discovery', cost: 2 });

test('returns bounded deduplicated public movie and TV snapshots', async () => {
  const calls = [];
  const result = await handleDiscovery(route, {
    token: 'test-token',
    fetchTmdbJson: async (options) => {
      calls.push(options);
      const movie = options.endpoint.includes('/movie/');
      return { results: [
        { id: 1, title: ' Movie ', name: ' Show ', release_date: '2026-01-02', first_air_date: '2025-01-01', poster_path: '/poster.jpg', overview: 'private' },
        { id: 1, title: 'Duplicate', name: 'Duplicate' },
        { id: -2, title: 'Invalid', name: 'Invalid' },
        { id: 3, title: 'Adult', name: 'Adult', adult: true },
        { id: 4, title: movie ? 'Fallback' : undefined, name: 'Fallback', poster_path: '//other.example/image' },
        ...Array.from({ length: 25 }, (_, index) => ({ id: index + 10, title: `Movie ${index}`, name: `Show ${index}` })),
      ] };
    },
  });

  assert.deepEqual(calls.map(({ endpoint, route: routeName, token }) => ({ endpoint, routeName, token })), [
    { endpoint: '/3/trending/movie/week?language=en-GB', routeName: 'discovery', token: 'test-token' },
    { endpoint: '/3/trending/tv/week?language=en-GB', routeName: 'discovery', token: 'test-token' },
  ]);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.movies.slice(0, 2), [
    { id: 1, title: 'Movie', mediaType: 'Movie', year: '2026', posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg' },
    { id: 4, title: 'Fallback', mediaType: 'Movie', year: null, posterUrl: null },
  ]);
  assert.deepEqual(result.body.tv[0], {
    id: 1, title: 'Show', mediaType: 'TV', year: '2025', posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
  });
  assert.equal(result.body.movies.length, 20);
  assert.equal(result.body.tv.length, 20);
  assert.doesNotMatch(JSON.stringify(result), /private|overview|adult|release_date|poster_path/);
});

test('returns a safe configuration failure without upstream work', async () => {
  const result = await handleDiscovery(route, {
    token: '',
    fetchTmdbJson: async () => { throw new Error('should not fetch'); },
  });
  assert.deepEqual(result, { status: 503, body: { error: 'Discovery is not configured yet.' } });
});

test('maps transport and malformed payload failures to one safe response', async () => {
  const failures = [
    async () => { throw new TmdbError('throttled', 429); },
    async () => { throw new TmdbError('upstream', 500); },
    async () => ({ results: 'private upstream body' }),
  ];
  for (const fetchTmdbJson of failures) {
    const result = await handleDiscovery(route, { token: 'private-token', fetchTmdbJson });
    assert.deepEqual(result, {
      status: 502,
      body: { error: 'Discovery is temporarily unavailable. Please try again.' },
    });
    assert.doesNotMatch(JSON.stringify(result), /private-token|private upstream body/);
  }
});
