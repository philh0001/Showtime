import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { validateBase, runSmoke } from './smoke-worker.mjs';

test('requires HTTPS except for local smoke targets', () => {
  assert.throws(() => validateBase('http://example.test'), /HTTPS/);
  assert.equal(validateBase('http://127.0.0.1').hostname, '127.0.0.1');
  assert.equal(validateBase('https://api.example.test').protocol, 'https:');
});

test('checks the fixed public route table without printing response bodies', async () => {
  const server = createServer((request, response) => {
    const origin = request.headers.origin;
    const status = origin === 'https://evil.example'
      ? 403
      : request.method !== 'GET' ? 405
        : request.url === '/search?query=' ? 400
          : request.url === '/not-found' ? 404 : 200;
    response.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'x-request-id': 'test-request-id',
    });
    response.end(JSON.stringify({ ok: true }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    await runSmoke(validateBase(`http://127.0.0.1:${port}`));
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
