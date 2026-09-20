import assert from 'node:assert/strict';

const canary = process.env.SHOWTIME_SMOKE_CANARY ?? 'showtime-smoke-canary';

export function validateBase(value) {
  const base = new URL(value);
  if (base.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(base.hostname)) {
    throw new Error('SHOWTIME_API_URL must use HTTPS.');
  }
  return base;
}

export function validateOrigin(value) {
  const origin = new URL(value).origin;
  if (!origin.startsWith('https://')) throw new Error('SHOWTIME_FRONTEND_ORIGIN must use HTTPS.');
  return origin;
}

async function check(base, route, expectedStatus, origin, options = {}) {
  const response = await fetch(new URL(route, base), {
    ...options,
    headers: { Origin: origin, ...(options.headers ?? {}) },
  });
  const body = await response.text();
  assert.equal(response.status, expectedStatus, `${route} returned an unexpected status`);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff', `${route} missing nosniff`);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer', `${route} missing referrer policy`);
  assert.ok(response.headers.get('x-request-id'), `${route} missing request ID`);
  assert.ok(!body.includes(canary), `${route} exposed the smoke canary`);
  if (expectedStatus !== 204) assert.match(response.headers.get('content-type') ?? '', /application\/json/);
}

export async function runSmoke(base, origin) {
  const routes = [
    ['/search?query=Batman', 200],
    ['/discovery', 200],
    ['/details/movie/1', 200],
    ['/details/tv/1', 200],
    ['/details/tv/1/season/1', 200],
    ['/details/person/1', 200],
    ['/search?query=', 400],
    ['/not-found', 404],
    ['/discovery', 405, { method: 'POST' }],
  ];
  for (const [route, status, options] of routes) await check(base, route, status, origin, options);
  await check(base, '/discovery', 403, origin, { headers: { Origin: 'https://evil.example' } });
  console.log(`PASS smoke routes (${routes.length + 1})`);
}

if (process.argv[1] && new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href === import.meta.url) {
  try {
    const origin = validateOrigin(
      process.env.SHOWTIME_FRONTEND_ORIGIN ?? 'https://showtimetracker.show',
    );
    await runSmoke(validateBase(process.env.SHOWTIME_API_URL), origin);
  } catch (error) {
    console.error(`FAIL smoke: ${error.message}`);
    process.exitCode = 1;
  }
}
