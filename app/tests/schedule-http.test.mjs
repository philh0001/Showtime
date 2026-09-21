import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchScheduleAt, ScheduleFetchError } from '../src/services/schedule-http.ts';

test('uses the public schedule path and rejects throttled responses', async () => {
  const calls = [];
  await assert.rejects(fetchScheduleAt('https://api.test', 123, async (url) => {
    calls.push(url); return new Response('{}', { status: 429 });
  }), (error) => error instanceof ScheduleFetchError && error.status === 429);
  assert.deepEqual(calls, ['https://api.test/schedule/tv/123']);
});

test('ends a stalled schedule request so the refresh queue can continue', async () => {
  let aborted = false;
  await assert.rejects(fetchScheduleAt('https://api.test', 123, (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); });
  }), 10), (error) => error instanceof ScheduleFetchError && error.status === 0);
  assert.equal(aborted, true);
});

test('keeps the timeout active while reading a stalled response body', async () => {
  let abortSignal;
  let streamController;
  const pending = fetchScheduleAt('https://api.test', 123, async (_url, init) => {
    abortSignal = init.signal;
    abortSignal.addEventListener('abort', () => streamController.error(new Error('aborted')));
    return new Response(new ReadableStream({ start(controller) { streamController = controller; } }));
  }, 10);
  void pending.catch(() => undefined);
  try {
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(abortSignal.aborted, true);
    await assert.rejects(pending, (error) => error instanceof ScheduleFetchError && error.status === 0);
  } finally {
    if (!abortSignal.aborted) streamController.error(new Error('test cleanup'));
    await pending.catch(() => undefined);
  }
});
