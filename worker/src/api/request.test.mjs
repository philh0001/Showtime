import assert from 'node:assert/strict';
import test from 'node:test';

import { parseApiRequest } from './request.mjs';

const parseGet = (path) => parseApiRequest({ method: 'GET', url: `https://api.test${path}` });

test('returns exact immutable routes, canonical cache keys, and reserved work costs', () => {
  const cases = [
    ['/search?query=%20Batman%20', {
      kind: 'search', query: 'Batman', cacheKey: '/search?query=Batman', cost: 1,
    }],
    ['/discovery', { kind: 'discovery', cacheKey: '/discovery', cost: 2 }],
    ['/details/movie/272', {
      kind: 'movie-details', id: 272, cacheKey: '/details/movie/272', cost: 4,
    }],
    ['/details/tv/1396', {
      kind: 'tv-details', id: 1396, cacheKey: '/details/tv/1396', cost: 5,
    }],
    ['/details/tv/1396/season/1', {
      kind: 'season-details', id: 1396, seasonNumber: 1,
      cacheKey: '/details/tv/1396/season/1', cost: 1,
    }],
    ['/details/person/287', {
      kind: 'person-details', id: 287, cacheKey: '/details/person/287', cost: 1,
    }],
  ];

  for (const [path, route] of cases) {
    const result = parseGet(path);
    assert.deepEqual(result, { ok: true, route }, path);
    assert.equal(Object.isFrozen(result.route), true, path);
  }
});

test('requires exactly one trimmed search query of 1 to 100 characters', () => {
  assert.deepEqual(parseGet(`/search?query=${'a'.repeat(100)}`).route.query, 'a'.repeat(100));

  for (const path of [
    '/search',
    '/search?query=',
    '/search?query=%20%20',
    `/search?query=${'a'.repeat(101)}`,
    '/search?query=a&query=b',
    '/search?query=a&extra=b',
  ]) {
    assert.deepEqual(parseGet(path), {
      ok: false, status: 400, body: { error: 'Enter a title of 1–100 characters.' },
    }, path);
  }
});

test('rejects query parameters on every non-search route', () => {
  for (const path of [
    '/discovery?extra=b',
    '/details/movie/272?extra=b',
    '/details/tv/1396?extra=b',
    '/details/tv/1396/season/1?extra=b',
    '/details/person/287?extra=b',
  ]) {
    const result = parseGet(path);
    assert.equal(result.ok, false, path);
    assert.equal(result.status, 400, path);
    assert.equal(typeof result.body.error, 'string', path);
  }
});

test('rejects noncanonical or unsafe detail numbers as recognized malformed routes', () => {
  for (const path of [
    '/details/movie/0',
    '/details/movie/01',
    '/details/movie/+1',
    '/details/movie/9007199254740992',
    '/details/tv/-1',
    '/details/person/1.5',
    '/details/tv/1/season/0',
    '/details/tv/1/season/01',
    '/details/tv/1/season/9007199254740992',
  ]) {
    const result = parseGet(path);
    assert.equal(result.ok, false, path);
    assert.equal(result.status, 400, path);
    assert.equal(typeof result.body.error, 'string', path);
  }
});

test('returns 404 for paths outside the closed route set', () => {
  for (const path of [
    '/',
    '/search/',
    '/Discovery',
    '/details/company/1',
    '/details/movie/1/extra',
    '/details/tv/1/season/1/extra',
    '/details/%2e%2e/discovery',
  ]) {
    assert.deepEqual(parseGet(path), {
      ok: false, status: 404, body: { error: 'Not found.' },
    }, path);
  }
});

test('rejects unsupported methods with the complete Allow value', () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'HEAD', 'get']) {
    assert.deepEqual(parseApiRequest({ method, url: 'https://api.test/search?query=a' }), {
      ok: false,
      status: 405,
      body: { error: 'Use GET.' },
      allow: 'GET, OPTIONS',
    }, method);
  }
});

test('parses OPTIONS only as a zero-cost adapter route', () => {
  assert.deepEqual(
    parseApiRequest({ method: 'OPTIONS', url: 'https://api.test/details/movie/272' }),
    { ok: true, route: { kind: 'options', cacheKey: '/details/movie/272', cost: 0 } },
  );
  assert.equal(parseApiRequest({ method: 'OPTIONS', url: 'https://api.test/unknown' }).status, 404);
  assert.equal(parseApiRequest({ method: 'OPTIONS', url: 'https://api.test/details/movie/0' }).status, 400);
});

test('enforces the full URL limit in UTF-8 bytes before route handling', () => {
  const prefix = 'https://api.test/search?query=';
  const atLimit = `${prefix}${'a'.repeat(2048 - prefix.length)}`;
  const overLimitAscii = `${atLimit}a`;
  const overLimitUtf8 = `${prefix}${'a'.repeat(2048 - prefix.length - 1)}£`;

  assert.equal(new TextEncoder().encode(atLimit).byteLength, 2048);
  assert.equal(parseApiRequest({ method: 'GET', url: atLimit }).status, 400);
  for (const url of [overLimitAscii, overLimitUtf8]) {
    assert.deepEqual(parseApiRequest({ method: 'GET', url }), {
      ok: false, status: 414, body: { error: 'Request URL is too long.' },
    });
  }
});
