import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchTmdbJson } from './tmdb.mjs';

const FOUR_MIB = 4 * 1024 * 1024;

test('constructs only fixed-origin URLs and rejects redirects', async () => {
  const calls = [];
  const result = await fetchTmdbJson({
    endpoint: '/3/movie/1?language=en-GB',
    route: '/details/movie/:id',
    token: 'canary-secret',
    fetchImpl: async (url, init) => {
      calls.push([String(url), init]);
      return Response.json({ id: 1 });
    },
  });

  assert.deepEqual(result, { id: 1 });
  assert.equal(calls[0][0], 'https://api.themoviedb.org/3/movie/1?language=en-GB');
  assert.equal(calls[0][1].redirect, 'error');
  assert.equal(calls[0][1].headers.Authorization, 'Bearer canary-secret');
  assert.equal(calls[0][1].headers.accept, 'application/json');

  for (const endpoint of [
    'https://evil.test/3/movie/1',
    '//evil.test/3/movie/1',
    '/3/../admin',
    '/3/movie\\1',
    '/3/movie/1\nInjected: yes',
  ]) {
    await assert.rejects(
      fetchTmdbJson({ endpoint, route: '/details/movie/:id', token: 'x', fetchImpl: async () => Response.json({}) }),
      TypeError,
      endpoint,
    );
  }
});

test('rejects declared and streamed bodies above the configured limit', async () => {
  await assert.rejects(
    fetchTmdbJson({
      endpoint: '/3/movie/1',
      route: '/details/movie/:id',
      token: 'x',
      maxBytes: FOUR_MIB,
      fetchImpl: async () => new Response('{}', {
        headers: { 'Content-Length': String(FOUR_MIB + 1) },
      }),
    }),
    (error) => error?.kind === 'too-large',
  );

  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(FOUR_MIB));
      controller.enqueue(new Uint8Array([1]));
      controller.close();
    },
  });
  await assert.rejects(
    fetchTmdbJson({
      endpoint: '/3/movie/1',
      route: '/details/movie/:id',
      token: 'x',
      maxBytes: FOUR_MIB,
      fetchImpl: async () => new Response(body),
    }),
    (error) => error?.kind === 'too-large',
  );
});

test('classifies safe upstream errors without exposing response data', async () => {
  const cases = [
    [404, 'not-found'],
    [429, 'throttled'],
    [401, 'upstream'],
    [500, 'upstream'],
  ];

  for (const [status, kind] of cases) {
    await assert.rejects(
      fetchTmdbJson({
        endpoint: '/3/movie/1?api_key=query-secret',
        route: '/details/movie/:id',
        token: 'header-secret',
        fetchImpl: async () => new Response('private upstream body', {
          status,
          headers: { 'x-private': 'private-header' },
        }),
      }),
      (error) => {
        assert.equal(error.kind, kind);
        const exposed = JSON.stringify(error);
        assert.doesNotMatch(exposed, /private upstream body|private-header|query-secret|header-secret/);
        return true;
      },
    );
  }
});

test('classifies malformed JSON and empty successful bodies as invalid', async () => {
  for (const body of ['not json', '']) {
    await assert.rejects(
      fetchTmdbJson({
        endpoint: '/3/movie/1',
        route: '/details/movie/:id',
        token: 'x',
        fetchImpl: async () => new Response(body),
      }),
      (error) => error?.kind === 'invalid-body',
    );
  }
});

test('aborts work at the deadline and classifies the timeout', async () => {
  const fetchImpl = async (_url, { signal }) => new Promise((_resolve, reject) => {
    const inFlight = setTimeout(() => reject(new Error('request did not abort')), 1_000);
    signal.addEventListener('abort', () => {
      clearTimeout(inFlight);
      reject(signal.reason);
    }, { once: true });
  });

  await assert.rejects(
    fetchTmdbJson({
      endpoint: '/3/movie/1',
      route: '/details/movie/:id',
      token: 'x',
      timeoutMs: 5,
      fetchImpl,
    }),
    (error) => error?.kind === 'timeout',
  );
});

test('applies the deadline while reading a stalled response body', async () => {
  const stalledBody = new ReadableStream({
    pull() {
      return new Promise(() => {});
    },
  });

  await assert.rejects(
    fetchTmdbJson({
      endpoint: '/3/movie/1',
      route: '/details/movie/:id',
      token: 'x',
      timeoutMs: 5,
      fetchImpl: async () => new Response(stalledBody),
    }),
    (error) => error?.kind === 'timeout',
  );
});

test('sanitizes response stream failures', async () => {
  const privateDetail = 'private upstream stream detail';
  const failedBody = new ReadableStream({
    start(controller) {
      controller.error(new Error(privateDetail));
    },
  });

  await assert.rejects(
    fetchTmdbJson({
      endpoint: '/3/movie/1',
      route: '/details/movie/:id',
      token: 'x',
      fetchImpl: async () => new Response(failedBody),
    }),
    (error) => {
      assert.equal(error?.kind, 'upstream');
      assert.doesNotMatch(JSON.stringify(error), new RegExp(privateDetail));
      return true;
    },
  );
});

test('preserves the oversize classification when stream cancellation fails', async () => {
  const body = new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array([1, 2]));
    },
    cancel() {
      return Promise.reject(new Error('private cancel detail'));
    },
  });

  await assert.rejects(
    fetchTmdbJson({
      endpoint: '/3/movie/1',
      route: '/details/movie/:id',
      token: 'x',
      maxBytes: 1,
      fetchImpl: async () => new Response(body),
    }),
    (error) => error?.kind === 'too-large' && !JSON.stringify(error).includes('private cancel detail'),
  );
});

test('logs bounded metadata without credentials, query values, or bodies', async () => {
  const events = [];
  const token = 'token-shaped-canary.ABC123.secret';
  await assert.rejects(
    fetchTmdbJson({
      endpoint: '/3/search/movie?query=private-search',
      route: '/search',
      token,
      fetchImpl: async () => new Response('private response body', { status: 503 }),
      log: (event) => events.push(event),
    }),
    (error) => error?.kind === 'upstream',
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].route, '/search');
  assert.equal(events[0].status, 503);
  assert.equal(typeof events[0].durationMs, 'number');
  assert.deepEqual(Object.keys(events[0]).sort(), ['durationMs', 'route', 'status']);
  assert.doesNotMatch(JSON.stringify(events), new RegExp(`${token}|private-search|private response body`));
});
