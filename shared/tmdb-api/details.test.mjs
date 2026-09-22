import assert from 'node:assert/strict';
import test from 'node:test';

import { handleDetails } from './details.mjs';
import { TmdbError } from './tmdb.mjs';

const movieRoute = Object.freeze({
  kind: 'movie-details', id: 272, cacheKey: '/details/movie/272', cost: 4,
});
const tvRoute = Object.freeze({
  kind: 'tv-details', id: 1396, cacheKey: '/details/tv/1396', cost: 5,
});
const seasonRoute = Object.freeze({
  kind: 'season-details', id: 1396, seasonNumber: 1,
  cacheKey: '/details/tv/1396/season/1', cost: 1,
});
const personRoute = Object.freeze({
  kind: 'person-details', id: 287, cacheKey: '/details/person/287', cost: 1,
});

test('maps movie details, cast, crew, trailer and UK providers to the exact public contract', async () => {
  const requests = [];
  const log = () => {};
  const result = await handleDetails(movieRoute, {
    token: 'private-test-token',
    optionalTimeoutMs: 75,
    log,
    fetchTmdbJson: async (options) => {
      requests.push(options);
      if (options.endpoint === '/3/movie/272') return {
        id: 272,
        title: ' Batman Begins ',
        overview: ' A new beginning. ',
        release_date: '2005-06-10',
        vote_average: 7.7,
        vote_count: 150,
        poster_path: '/poster.jpg',
        backdrop_path: '/backdrop.jpg',
        genres: [{ id: 28, name: ' Action ' }],
        private_field: 'must-not-return',
      };
      if (options.endpoint === '/3/movie/272/credits') return {
        cast: [
          { id: 10, name: ' Actor ', character: ' Hero ', profile_path: '/actor.jpg' },
          { id: 10, name: 'Duplicate' },
          { id: -1, name: 'Invalid' },
        ],
        crew: [
          { id: 20, name: ' Director ', job: 'Director' },
          { id: 21, name: 'Other', job: 'Driver' },
        ],
      };
      if (options.endpoint === '/3/movie/272/videos') return { results: [
        { site: 'YouTube', type: 'Trailer', official: false, key: 'abcdefghijk', name: 'Fan trailer' },
        { site: 'YouTube', type: 'Trailer', official: true, key: 'javascript:bad', name: 'Invalid' },
        { site: 'YouTube', type: 'Trailer', official: true, key: 'A1b2C3d4E5f', name: ' Official trailer ' },
      ] };
      if (options.endpoint === '/3/movie/272/watch/providers?watch_region=GB') return {
        results: { GB: {
          link: 'https://www.themoviedb.org/movie/272/watch',
          flatrate: [
            { provider_id: 8, provider_name: ' Netflix ', logo_path: '/netflix.jpg', private: 'omit' },
            { provider_id: 9, provider_name: 'Amazon Prime Video with Ads', logo_path: '/prime.jpg' },
          ],
          rent: [{ provider_id: 10, provider_name: 'RentCo', logo_path: '/rent.jpg' }],
          buy: [
            { provider_id: 10, provider_name: 'Duplicate ID' },
            { provider_id: 11, provider_name: 'BuyCo', logo_path: null },
          ],
        } },
      };
      throw new Error(`Unexpected endpoint: ${options.endpoint}`);
    },
  });

  assert.deepEqual(result, { status: 200, body: { details: {
    id: 272,
    mediaType: 'Movie',
    title: 'Batman Begins',
    overview: 'A new beginning.',
    releaseDate: '2005-06-10',
    posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/w780/backdrop.jpg',
    rating: 7.7,
    genres: ['Action'],
    seasons: [],
    nextEpisode: null,
    latestSeason: null,
    cast: [{
      id: 10,
      name: 'Actor',
      character: 'Hero',
      profileUrl: 'https://image.tmdb.org/t/p/w185/actor.jpg',
    }],
    crew: [{ id: 20, name: 'Director', job: 'Director' }],
    trailer: {
      name: 'Official trailer',
      url: 'https://www.youtube.com/watch?v=A1b2C3d4E5f',
    },
    watchProviders: {
      status: 'available',
      region: 'GB',
      link: 'https://www.themoviedb.org/movie/272/watch',
      providers: [
        { id: 8, name: 'Netflix', logoUrl: 'https://image.tmdb.org/t/p/w92/netflix.jpg', offers: 'stream' },
        { id: 9, name: 'Amazon Prime Video', logoUrl: 'https://image.tmdb.org/t/p/w92/prime.jpg', offers: 'stream' },
        { id: 10, name: 'RentCo', logoUrl: 'https://image.tmdb.org/t/p/w92/rent.jpg', offers: 'rent' },
        { id: 11, name: 'BuyCo', logoUrl: null, offers: 'buy' },
      ],
    },
  } } });
  assert.deepEqual(requests.map(({ endpoint }) => endpoint).sort(), [
    '/3/movie/272',
    '/3/movie/272/credits',
    '/3/movie/272/videos',
    '/3/movie/272/watch/providers?watch_region=GB',
  ].sort());
  assert.ok(requests.every((request) => request.token === 'private-test-token'
    && request.route === 'movie-details' && request.log === log));
  assert.ok(requests.filter(({ endpoint }) => endpoint !== '/3/movie/272')
    .every(({ timeoutMs }) => timeoutMs === 75));
  assert.equal(requests.find(({ endpoint }) => endpoint === '/3/movie/272').timeoutMs, undefined);
  assert.doesNotMatch(JSON.stringify(result), /private_field|must-not-return|private-test-token/);
});

test('maps TV season summaries, next episode and the latest season exactly', async () => {
  const result = await handleDetails(tvRoute, {
    token: 'test-token',
    fetchTmdbJson: async ({ endpoint }) => {
      if (endpoint === '/3/tv/1396') return {
        id: 1396,
        name: 'Breaking Bad',
        first_air_date: '2008-01-20',
        seasons: [
          { id: 4, name: 'Season 3', season_number: 3, episode_count: 0, air_date: '2010-01-01' },
          { id: 3, name: ' Season 2 ', season_number: 2, episode_count: 3, air_date: '2009-03-08' },
          { id: 2, name: 'Season 1', season_number: 1, episode_count: 7, air_date: '2008-01-20' },
          { id: 1, name: '', season_number: 0, episode_count: 3, air_date: null },
        ],
        next_episode_to_air: {
          id: 500,
          name: ' A New Start ',
          season_number: 2,
          episode_number: 1,
          air_date: '2030-02-28',
          overview: 'must-not-return',
        },
      };
      if (endpoint === '/3/tv/1396/season/2') return {
        id: 3,
        name: ' Season 2 ',
        season_number: 2,
        episodes: [
          { id: 202, name: ' Second ', season_number: 2, episode_number: 2, air_date: '2009-03-15' },
          { id: 201, name: '', season_number: 2, episode_number: 1, air_date: '2009-03-08' },
          { id: 0, name: 'Invalid', season_number: 2, episode_number: 3, air_date: '2009-03-22' },
          { id: 204, name: 'Unknown date', season_number: 2, episode_number: 4, air_date: null },
        ],
      };
      if (endpoint.endsWith('/credits')) return { cast: [], crew: [] };
      if (endpoint.endsWith('/videos')) return { results: [] };
      if (endpoint.endsWith('/watch/providers?watch_region=GB')) return { results: { GB: {} } };
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    },
  });

  assert.deepEqual(result, { status: 200, body: { details: {
    id: 1396,
    mediaType: 'TV',
    title: 'Breaking Bad',
    overview: null,
    releaseDate: '2008-01-20',
    posterUrl: null,
    backdropUrl: null,
    rating: null,
    genres: [],
    seasons: [
      { id: 1, name: 'Specials', seasonNumber: 0, episodeCount: 3, airDate: null },
      { id: 2, name: 'Season 1', seasonNumber: 1, episodeCount: 7, airDate: '2008-01-20' },
      { id: 3, name: 'Season 2', seasonNumber: 2, episodeCount: 3, airDate: '2009-03-08' },
      { id: 4, name: 'Season 3', seasonNumber: 3, episodeCount: 0, airDate: '2010-01-01' },
    ],
    nextEpisode: {
      id: 500, name: 'A New Start', seasonNumber: 2, episodeNumber: 1, airDate: '2030-02-28',
    },
    latestSeason: {
      seasonNumber: 2,
      name: 'Season 2',
      episodes: [
        { id: 201, name: null, seasonNumber: 2, episodeNumber: 1, airDate: '2009-03-08' },
        { id: 202, name: 'Second', seasonNumber: 2, episodeNumber: 2, airDate: '2009-03-15' },
        { id: 204, name: 'Unknown date', seasonNumber: 2, episodeNumber: 4, airDate: null },
      ],
    },
    cast: [],
    crew: [],
    trailer: null,
    watchProviders: { status: 'none', region: 'GB', link: null, providers: [] },
  } } });
});

test('returns the exact on-demand season contract with only validated episodes', async () => {
  const result = await handleDetails(seasonRoute, {
    token: 'test-token',
    fetchTmdbJson: async ({ endpoint, route, token }) => {
      assert.equal(endpoint, '/3/tv/1396/season/1');
      assert.equal(route, 'season-details');
      assert.equal(token, 'test-token');
      return {
        id: 2,
        name: ' Season 1 ',
        season_number: 1,
        episodes: [
          { id: 102, name: ' Second ', season_number: 1, episode_number: 2, air_date: null, overview: 'private' },
          { id: 101, name: '', season_number: 1, episode_number: 1, air_date: '2008-01-20' },
          { id: 0, name: 'Invalid', season_number: 1, episode_number: 3, air_date: '2008-02-01' },
        ],
      };
    },
  });

  assert.deepEqual(result, { status: 200, body: { season: {
    seasonNumber: 1,
    name: 'Season 1',
    episodes: [
      { id: 101, name: null, seasonNumber: 1, episodeNumber: 1, airDate: '2008-01-20' },
      { id: 102, name: 'Second', seasonNumber: 1, episodeNumber: 2, airDate: null },
    ],
  } } });
  assert.doesNotMatch(JSON.stringify(result), /private|overview/);
});

test('returns the exact normalized person contract', async () => {
  const result = await handleDetails(personRoute, {
    token: 'test-token',
    fetchTmdbJson: async ({ endpoint, route }) => {
      assert.equal(endpoint, '/3/person/287');
      assert.equal(route, 'person-details');
      return {
        id: 287,
        name: ' Brad Pitt ',
        biography: ' Actor biography. ',
        birthday: '1963-12-18',
        known_for: [
          { title: 'Fight Club', private: 'omit' },
          { name: 'Se7en' },
          { title: '' },
          null,
          { title: 'AA' },
          { title: 'Too many' },
        ],
        private_field: 'must-not-return',
      };
    },
  });

  assert.deepEqual(result, { status: 200, body: { person: {
    id: 287,
    name: 'Brad Pitt',
    biography: 'Actor biography.',
    birthday: '1963-12-18',
    knownFor: ['Fight Club', 'Se7en', 'AA', 'Too many'],
  } } });
  assert.doesNotMatch(JSON.stringify(result), /private|must-not-return/);
});

test('optional credits, videos, providers and latest season fail independently', async () => {
  const optionalEndpoints = [
    '/3/tv/1396/credits',
    '/3/tv/1396/videos',
    '/3/tv/1396/watch/providers?watch_region=GB',
    '/3/tv/1396/season/1',
  ];

  for (const failedEndpoint of optionalEndpoints) {
    const result = await handleDetails(tvRoute, {
      token: 'test-token',
      optionalTimeoutMs: 25,
      fetchTmdbJson: async ({ endpoint, timeoutMs }) => {
        if (endpoint === '/3/tv/1396') return {
          id: 1396,
          name: 'Example',
          seasons: [{ id: 10, name: 'Season 1', season_number: 1, episode_count: 2 }],
        };
        assert.equal(timeoutMs, 25);
        if (endpoint === failedEndpoint) throw new TmdbError('timeout');
        if (endpoint.endsWith('/credits')) return {
          cast: [{ id: 1, name: 'Actor', character: 'Lead' }],
          crew: [{ id: 2, name: 'Director', job: 'Director' }],
        };
        if (endpoint.endsWith('/videos')) return { results: [
          { site: 'YouTube', type: 'Trailer', official: true, key: 'A1b2C3d4E5f', name: 'Trailer' },
        ] };
        if (endpoint.endsWith('/watch/providers?watch_region=GB')) return { results: { GB: {
          flatrate: [{ provider_id: 8, provider_name: 'Netflix' }],
        } } };
        return {
          id: 10,
          name: 'Season 1',
          season_number: 1,
          episodes: [{ id: 11, name: 'Pilot', season_number: 1, episode_number: 1, air_date: null }],
        };
      },
    });

    assert.equal(result.status, 200, failedEndpoint);
    const { details } = result.body;
    assert.deepEqual(details.cast, failedEndpoint.endsWith('/credits') ? [] : [
      { id: 1, name: 'Actor', character: 'Lead', profileUrl: null },
    ], failedEndpoint);
    assert.deepEqual(details.crew, failedEndpoint.endsWith('/credits') ? [] : [
      { id: 2, name: 'Director', job: 'Director' },
    ], failedEndpoint);
    assert.deepEqual(details.trailer, failedEndpoint.endsWith('/videos') ? null : {
      name: 'Trailer', url: 'https://www.youtube.com/watch?v=A1b2C3d4E5f',
    }, failedEndpoint);
    assert.deepEqual(details.watchProviders, failedEndpoint.includes('/watch/providers')
      ? { status: 'unavailable', region: 'GB', link: null, providers: [] }
      : { status: 'available', region: 'GB', link: null, providers: [
        { id: 8, name: 'Netflix', logoUrl: null, offers: 'stream' },
      ] }, failedEndpoint);
    assert.deepEqual(details.latestSeason, failedEndpoint.endsWith('/season/1') ? null : {
      seasonNumber: 1,
      name: 'Season 1',
      episodes: [{ id: 11, name: 'Pilot', seasonNumber: 1, episodeNumber: 1, airDate: null }],
    }, failedEndpoint);
  }
});

test('malformed optional payloads become empty optional fields', async () => {
  const result = await handleDetails(tvRoute, {
    token: 'test-token',
    fetchTmdbJson: async ({ endpoint }) => {
      if (endpoint === '/3/tv/1396') return {
        id: 1396,
        name: 'Example',
        seasons: [{ id: 10, name: 'Season 1', season_number: 1, episode_count: 2 }],
      };
      if (endpoint.endsWith('/credits')) return { cast: [null], crew: 'private' };
      if (endpoint.endsWith('/videos')) return { results: [null] };
      if (endpoint.endsWith('/watch/providers?watch_region=GB')) return { results: 'private' };
      return { id: 999, season_number: 1, episodes: 'private' };
    },
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.details.cast, []);
  assert.deepEqual(result.body.details.crew, []);
  assert.equal(result.body.details.trailer, null);
  assert.deepEqual(result.body.details.watchProviders, {
    status: 'unavailable', region: 'GB', link: null, providers: [],
  });
  assert.equal(result.body.details.latestSeason, null);
});

test('returns a safe configuration failure without contacting TMDB', async () => {
  const result = await handleDetails(movieRoute, {
    token: '',
    fetchTmdbJson: async () => { throw new Error('should not fetch'); },
  });
  assert.deepEqual(result, {
    status: 503,
    body: { error: 'Details are not configured yet.' },
  });
});

test('preserves exact not-found and throttled mappings for every primary details route', async () => {
  const cases = [
    [movieRoute, 'not-found', 404, 'This title could not be found.'],
    [tvRoute, 'throttled', 429, 'Please wait a moment and try again.'],
    [seasonRoute, 'not-found', 404, 'This season could not be found.'],
    [seasonRoute, 'throttled', 429, 'Please wait a moment and try again.'],
    [personRoute, 'not-found', 404, 'This person could not be found.'],
    [personRoute, 'throttled', 429, 'Please wait a moment and try again.'],
  ];

  for (const [route, kind, status, error] of cases) {
    const result = await handleDetails(route, {
      token: 'private-token',
      fetchTmdbJson: async () => { throw new TmdbError(kind, status); },
    });
    assert.deepEqual(result, { status, body: { error } }, `${route.kind}:${kind}`);
    assert.doesNotMatch(JSON.stringify(result), /private-token/);
  }
});

test('maps upstream status failures and thrown or malformed primary responses to safe errors', async () => {
  const cases = [
    [movieRoute, new TmdbError('upstream', 401), 'Details are temporarily unavailable.'],
    [seasonRoute, new TmdbError('upstream', 500), 'Season details are temporarily unavailable.'],
    [personRoute, new TmdbError('upstream', 403), 'Person details are temporarily unavailable.'],
    [movieRoute, new Error('private credential'), 'Could not load details. Please try again.'],
    [seasonRoute, new Error('private credential'), 'Could not load season details. Please try again.'],
    [personRoute, new Error('private credential'), 'Could not load person details. Please try again.'],
  ];

  for (const [route, failure, error] of cases) {
    const result = await handleDetails(route, {
      token: 'private-token',
      fetchTmdbJson: async () => { throw failure; },
    });
    assert.deepEqual(result, { status: 502, body: { error } }, route.kind);
    assert.doesNotMatch(JSON.stringify(result), /private|credential/);
  }

  for (const [route, payload, error] of [
    [movieRoute, { id: 999 }, 'Could not load details. Please try again.'],
    [seasonRoute, { id: 2, season_number: 2, episodes: [] }, 'Could not load season details. Please try again.'],
    [personRoute, { id: 287, name: '' }, 'Could not load person details. Please try again.'],
  ]) {
    const result = await handleDetails(route, {
      token: 'private-token',
      fetchTmdbJson: async () => payload,
    });
    assert.deepEqual(result, { status: 502, body: { error } }, route.kind);
  }
});
