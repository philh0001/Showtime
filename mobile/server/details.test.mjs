import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { createSearchHandler } from './search.mjs';

async function request(t, path, fetchImpl, method = 'GET', options = {}) {
  const server = createServer(createSearchHandler({
    token: 'private-test-token',
    fetchImpl,
    logger: { info() {} },
    ...options,
  }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  return fetch(`http://127.0.0.1:${server.address().port}${path}`, { method });
}

test('movie details use the movie endpoint and return only display fields', async (t) => {
  const response = await request(t, '/details/movie/272', async (url, options) => {
    if (options.headers.Authorization !== 'Bearer private-test-token') return new Response(null, { status: 401 });
    if (String(url) === 'https://api.themoviedb.org/3/movie/272') {
      return Response.json({ id: 272, title: 'Batman Begins', overview: 'A new beginning.',
        release_date: '2005-06-10', vote_average: 7.7, vote_count: 150,
        poster_path: '/poster.jpg', backdrop_path: '/backdrop.jpg',
        genres: [{ id: 28, name: 'Action' }], private_field: 'must-not-return' });
    }
    return new Response(null, { status: 404 });
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { details: {
    id: 272, mediaType: 'Movie', title: 'Batman Begins', overview: 'A new beginning.',
    releaseDate: '2005-06-10', rating: 7.7, genres: ['Action'],
    posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/w780/backdrop.jpg', seasons: [],
    nextEpisode: null,
    latestSeason: null,
    cast: [], crew: [], trailer: null,
  } });
});

test('details include validated cast, key crew and only official YouTube trailers', async (t) => {
  const response = await request(t, '/details/movie/1', async (url) => {
    if (String(url) === 'https://api.themoviedb.org/3/movie/1') {
      return Response.json({ id: 1, title: 'Movie' });
    }
    if (String(url).endsWith('/credits')) return Response.json({ cast: [
        { id: 10, name: ' Actor ', character: ' Hero ', profile_path: '/actor.jpg' },
        { id: 10, name: 'Duplicate' }, { id: -1, name: 'Invalid' },
      ],
      crew: [{ id: 20, name: 'Director', job: 'Director' }, { id: 21, name: 'Other', job: 'Driver' }],
    });
    return Response.json({ results: [
      { site: 'YouTube', type: 'Trailer', official: false, key: 'abcdefghijk', name: 'Fan trailer' },
      { site: 'YouTube', type: 'Trailer', official: true, key: 'javascript:bad', name: 'Invalid' },
      { site: 'YouTube', type: 'Trailer', official: true, key: 'A1b2C3d4E5f', name: 'Official trailer' },
    ] });
  });
  assert.equal(response.status, 200);
  const { details } = await response.json();
  assert.deepEqual(details.cast, [{ id: 10, name: 'Actor', character: 'Hero', profileUrl: 'https://image.tmdb.org/t/p/w185/actor.jpg' }]);
  assert.deepEqual(details.crew, [{ id: 20, name: 'Director', job: 'Director' }]);
  assert.deepEqual(details.trailer, { name: 'Official trailer', url: 'https://www.youtube.com/watch?v=A1b2C3d4E5f' });
});

test('malformed optional extras cannot break otherwise valid details', async (t) => {
  const response = await request(t, '/details/tv/1', async () => Response.json({ id: 1, name: 'Show',
    credits: { cast: [null, { id: 2, name: '' }], crew: 'invalid' }, videos: { results: [null] } }));
  const { details } = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(details.cast, []);
  assert.deepEqual(details.crew, []);
  assert.equal(details.trailer, null);
});

test('TV details use TV names/dates and retain specials and season summaries', async (t) => {
  const urls = [];
  const response = await request(t, '/details/tv/1396', async (url) => {
    urls.push(String(url));
    if (String(url) === 'https://api.themoviedb.org/3/tv/1396') {
      return Response.json({ id: 1396, name: 'Breaking Bad', first_air_date: '2008-01-20',
        overview: 'A chemistry teacher changes course.', vote_average: 8.9, vote_count: 200,
        genres: [{ id: 18, name: 'Drama' }], seasons: [
          { id: 4, name: 'Season 3', season_number: 3, episode_count: 0, air_date: '2010-01-01' },
          { id: 3, name: ' Season 2 ', season_number: 2, episode_count: 3, air_date: '2009-03-08' },
          { id: 2, name: 'Season 1', season_number: 1, episode_count: 7, air_date: '2008-01-20' },
          { id: 1, name: 'Specials', season_number: 0, episode_count: 3, air_date: null },
        ], next_episode_to_air: {
          id: 500, name: '  A New Start  ', season_number: 2, episode_number: 1,
          air_date: '2030-02-28', overview: 'must-not-return', still_path: '/private.jpg',
        } });
    }
    if (String(url) === 'https://api.themoviedb.org/3/tv/1396/season/2') {
      return Response.json({ id: 3, name: ' Season 2 ', season_number: 2, episodes: [
        { id: 202, name: ' Second ', season_number: 2, episode_number: 2, air_date: '2009-03-15', overview: 'private' },
        { id: 201, name: '', season_number: 2, episode_number: 1, air_date: '2009-03-08', still_path: '/private.jpg' },
        { id: 0, name: 'Malformed', season_number: 2, episode_number: 3, air_date: '2009-03-22' },
        { id: 204, name: 'Unknown date', season_number: 2, episode_number: 4, air_date: null },
        { id: 205, name: 'Wrong season', season_number: 1, episode_number: 5, air_date: '2009-04-01' },
      ] });
    }
    return new Response(null, { status: 404 });
  });
  assert.equal(response.status, 200);
  const { details } = await response.json();
  assert.equal(details.title, 'Breaking Bad');
  assert.equal(details.releaseDate, '2008-01-20');
  assert.equal(details.mediaType, 'TV');
  assert.deepEqual(details.seasons, [
    { id: 1, name: 'Specials', seasonNumber: 0, episodeCount: 3, airDate: null },
    { id: 2, name: 'Season 1', seasonNumber: 1, episodeCount: 7, airDate: '2008-01-20' },
    { id: 3, name: 'Season 2', seasonNumber: 2, episodeCount: 3, airDate: '2009-03-08' },
    { id: 4, name: 'Season 3', seasonNumber: 3, episodeCount: 0, airDate: '2010-01-01' },
  ]);
  assert.deepEqual(details.nextEpisode, {
    id: 500, name: 'A New Start', seasonNumber: 2, episodeNumber: 1,
    airDate: '2030-02-28',
  });
  assert.deepEqual(details.latestSeason, {
    seasonNumber: 2,
    name: 'Season 2',
    episodes: [
      { id: 201, name: null, seasonNumber: 2, episodeNumber: 1, airDate: '2009-03-08' },
      { id: 202, name: 'Second', seasonNumber: 2, episodeNumber: 2, airDate: '2009-03-15' },
      { id: 204, name: 'Unknown date', seasonNumber: 2, episodeNumber: 4, airDate: null },
    ],
  });
  assert.deepEqual(urls.sort(), [
    'https://api.themoviedb.org/3/tv/1396',
    'https://api.themoviedb.org/3/tv/1396/credits',
    'https://api.themoviedb.org/3/tv/1396/videos',
    'https://api.themoviedb.org/3/tv/1396/season/2',
  ].sort());
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
    nextEpisode: null,
    latestSeason: null,
    cast: [], crew: [], trailer: null,
  } });
});

test('a newest-season request failure preserves otherwise valid TV details', async (t) => {
  const response = await request(t, '/details/tv/1', async (url) => {
    if (String(url) === 'https://api.themoviedb.org/3/tv/1') {
      return Response.json({ id: 1, name: 'Example', seasons: [
        { id: 10, name: 'Season 1', season_number: 1, episode_count: 2, air_date: '2026-01-01' },
      ] });
    }
    throw new Error('season unavailable');
  });

  assert.equal(response.status, 200);
  const { details } = await response.json();
  assert.equal(details.title, 'Example');
  assert.equal(details.latestSeason, null);
  assert.equal(details.seasons.length, 1);
});

test('credits, videos and newest-season failures preserve the main TV details', async (t) => {
  const urls = [];
  const response = await request(t, '/details/tv/1', async (url) => {
    urls.push(String(url));
    if (String(url) === 'https://api.themoviedb.org/3/tv/1') {
      return Response.json({ id: 1, name: 'Example', seasons: [
        { id: 10, name: 'Season 1', season_number: 1, episode_count: 2, air_date: '2026-01-01' },
      ] });
    }
    if (String(url).endsWith('/videos')) throw new TypeError('network unavailable');
    return new Response(null, { status: 503 });
  });

  assert.equal(response.status, 200);
  const { details } = await response.json();
  assert.equal(details.title, 'Example');
  assert.deepEqual(details.cast, []);
  assert.deepEqual(details.crew, []);
  assert.equal(details.trailer, null);
  assert.equal(details.latestSeason, null);
  assert.deepEqual(urls.sort(), [
    'https://api.themoviedb.org/3/tv/1',
    'https://api.themoviedb.org/3/tv/1/credits',
    'https://api.themoviedb.org/3/tv/1/season/1',
    'https://api.themoviedb.org/3/tv/1/videos',
  ].sort());
});

test('a hanging optional request cannot outlive the details response budget', async (t) => {
  const startedAt = Date.now();
  const response = await request(t, '/details/tv/1', async (url, options) => {
    if (String(url) === 'https://api.themoviedb.org/3/tv/1') {
      return Response.json({ id: 1, name: 'Example', seasons: [
        { id: 10, name: 'Season 1', season_number: 1, episode_count: 2, air_date: '2026-01-01' },
      ] });
    }
    return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    });
  }, 'GET', { detailsOptionalTimeoutMs: 20 });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).details.title, 'Example');
  assert.ok(Date.now() - startedAt < 500);
});

test('development logs identify failed TMDB endpoints without response bodies', async (t) => {
  const entries = [];
  const logger = { info: (message, context) => entries.push([message, context]) };
  const response = await request(t, '/details/tv/1', async (url) => {
    if (String(url) === 'https://api.themoviedb.org/3/tv/1') {
      return Response.json({ id: 1, name: 'Example', seasons: [] });
    }
    return new Response('private-upstream-body', { status: 503 });
  }, 'GET', { logger });

  assert.equal(response.status, 200);
  assert.ok(entries.some(([message, context]) => message === 'TMDB request failed'
    && context.endpoint === '/3/tv/1/credits' && context.status === 503));
  assert.equal(JSON.stringify(entries).includes('private-upstream-body'), false);
});

test('missing and malformed next episodes are returned as null', async (t) => {
  const invalidValues = [
    undefined,
    { id: 4, name: 'Missing date', season_number: 2, episode_number: 3 },
    { id: 4, name: 'Impossible date', season_number: 2, episode_number: 3, air_date: '2030-02-30' },
    { id: 0, name: 'Invalid ID', season_number: 2, episode_number: 3, air_date: '2030-02-28' },
  ];

  for (const next_episode_to_air of invalidValues) {
    const response = await request(t, '/details/tv/1', async () => Response.json({
      id: 1, name: 'Example', seasons: [], next_episode_to_air,
    }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).details.nextEpisode, null);
  }
});

test('server preserves a structurally valid past-dated next episode', async (t) => {
  const response = await request(t, '/details/tv/1', async () => Response.json({
    id: 1, name: 'Example', seasons: [], next_episode_to_air: {
      id: 4, name: null, season_number: 2, episode_number: 3, air_date: '2001-01-01',
    },
  }));

  assert.deepEqual((await response.json()).details.nextEpisode, {
    id: 4, name: null, seasonNumber: 2, episodeNumber: 3, airDate: '2001-01-01',
  });
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
