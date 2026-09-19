import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../src/web-worker.ts';

function request(url) {
  return worker.fetch(new Request(url), {
    ASSETS: {
      fetch(assetRequest) {
        return Promise.resolve(new Response(assetRequest.url, { status: 200 }));
      },
    },
  });
}

test('redirects the legacy Workers hostname to the canonical domain', async () => {
  const root = await request('https://showtime-web.showtime-workers.workers.dev/');
  assert.equal(root.status, 301);
  assert.equal(root.headers.get('Location'), 'https://showtimetracker.show/');

  const pathAndQuery = await request('https://showtime-web.showtime-workers.workers.dev/search?q=batman');
  assert.equal(pathAndQuery.status, 301);
  assert.equal(pathAndQuery.headers.get('Location'), 'https://showtimetracker.show/search?q=batman');
});

test('serves assets without redirecting requests to the canonical hostname', async () => {
  const response = await request('https://showtimetracker.show/profile');

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'https://showtimetracker.show/profile');
});
