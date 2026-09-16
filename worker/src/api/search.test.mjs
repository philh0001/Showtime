import assert from 'node:assert/strict';
import test from 'node:test';

import { handleSearch } from './search.mjs';
import { TmdbError } from './tmdb.mjs';

const route = Object.freeze({
  kind: 'search',
  query: 'Batman',
  cacheKey: '/search?query=Batman',
  cost: 1,
});

test('maps the bounded public search contract and excludes people', async () => {
  let request;
  const result = await handleSearch(route, {
    token: 'test-token',
    fetchTmdbJson: async (options) => {
      request = options;
      return { results: [
        { id: 1, media_type: 'person', name: 'Actor' },
        { id: 2, media_type: 'movie', title: 'Batman', release_date: '1989-06-23', poster_path: '/poster.jpg' },
        { id: 2, media_type: 'tv', name: 'Batman', first_air_date: '', poster_path: null },
        { id: 3, media_type: 'movie', title: '   ', release_date: 'invalid', poster_path: 'unsafe.jpg' },
      ] };
    },
  });

  assert.equal(request.endpoint, '/3/search/multi?query=Batman&include_adult=false&page=1');
  assert.equal(request.route, 'search');
  assert.equal(request.token, 'test-token');
  assert.deepEqual(result, { status: 200, body: { results: [
    { id: 'movie-2', title: 'Batman', year: '1989', mediaType: 'Movie', posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg' },
    { id: 'tv-2', title: 'Batman', year: null, mediaType: 'TV', posterUrl: null },
    { id: 'movie-3', title: 'Untitled', year: null, mediaType: 'Movie', posterUrl: null },
  ] } });
});

test('returns a safe configuration failure without contacting TMDB', async () => {
  const result = await handleSearch(route, {
    token: '',
    fetchTmdbJson: async () => { throw new Error('should not fetch'); },
  });
  assert.deepEqual(result, { status: 503, body: { error: 'Search is not configured yet.' } });
});

test('maps transport failures to stable public responses', async () => {
  const cases = [
    ['not-found', 502, 'Search is temporarily unavailable. Please try again.'],
    ['throttled', 429, 'Please wait a moment before searching again.'],
    ['upstream', 502, 'Could not reach the search service. Please try again.'],
    ['timeout', 502, 'Could not reach the search service. Please try again.'],
    ['invalid-body', 502, 'Search is temporarily unavailable. Please try again.'],
    ['too-large', 502, 'Search is temporarily unavailable. Please try again.'],
  ];

  for (const [kind, status, message] of cases) {
    const result = await handleSearch(route, {
      token: 'private-token',
      fetchTmdbJson: async () => { throw new TmdbError(kind); },
    });
    assert.deepEqual(result, { status, body: { error: message } }, kind);
    assert.doesNotMatch(JSON.stringify(result), /private-token/);
  }
});

test('rejects malformed upstream payloads without leaking their contents', async () => {
  for (const payload of [null, {}, { results: 'private upstream body' }]) {
    const result = await handleSearch(route, {
      token: 'private-token',
      fetchTmdbJson: async () => payload,
    });
    assert.deepEqual(result, {
      status: 502,
      body: { error: 'Could not reach the search service. Please try again.' },
    });
    assert.doesNotMatch(JSON.stringify(result), /private-token|private upstream body/);
  }
});
