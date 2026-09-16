const TMDB_ORIGIN = 'https://api.themoviedb.org';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 4 * 1024 * 1024;

export class TmdbError extends Error {
  constructor(kind, status = 0) {
    super(`TMDB request failed: ${kind}`);
    this.name = 'TmdbError';
    this.kind = kind;
    this.status = status;
  }
}

function validateEndpoint(endpoint) {
  if (typeof endpoint !== 'string'
    || !endpoint.startsWith('/3/')
    || /[\\\u0000-\u001f\u007f]/.test(endpoint)) {
    throw new TypeError('Invalid TMDB endpoint');
  }

  const pathname = endpoint.split(/[?#]/, 1)[0];
  if (pathname.split('/').some((segment) => {
    const dots = segment.replaceAll(/%2e/gi, '.');
    return dots === '.' || dots === '..';
  })) {
    throw new TypeError('Invalid TMDB endpoint');
  }

  const url = new URL(endpoint, TMDB_ORIGIN);
  if (url.origin !== TMDB_ORIGIN || url.username || url.password || !url.pathname.startsWith('/3/')) {
    throw new TypeError('Invalid TMDB origin');
  }
  return url;
}

function classifyStatus(status) {
  if (status === 404) return 'not-found';
  if (status === 429) return 'throttled';
  return 'upstream';
}

function readWithSignal(reader, signal, status) {
  if (signal.aborted) return Promise.reject(new TmdbError('timeout', status));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new TmdbError('timeout', status));
    signal.addEventListener('abort', onAbort, { once: true });
    reader.read().then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort);
    });
  });
}

async function readBoundedBody(response, maxBytes, signal) {
  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    throw new TmdbError('too-large', response.status);
  }

  if (!response.body) throw new TmdbError('invalid-body', response.status);

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await readWithSignal(reader, signal, response.status);
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        void reader.cancel().catch(() => {});
        throw new TmdbError('too-large', response.status);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof TmdbError) {
      if (error.kind === 'timeout') void reader.cancel().catch(() => {});
      throw error;
    }
    void reader.cancel().catch(() => {});
    throw new TmdbError(signal.aborted ? 'timeout' : 'upstream', response.status);
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // A pending read owns the lock until cancellation settles.
    }
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function emitLog(log, route, status, startedAt) {
  try {
    log({
      route,
      status,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    });
  } catch {
    // Observability must not change the API result.
  }
}

export async function fetchTmdbJson({
  endpoint,
  route,
  token,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = MAX_BODY_BYTES,
  log = () => {},
}) {
  const url = validateEndpoint(endpoint);
  if (typeof token !== 'string' || token.length === 0) throw new TypeError('Missing TMDB token');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError('Invalid timeout');
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new TypeError('Invalid body limit');

  const startedAt = performance.now();
  let status = 0;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const { signal } = controller;
  try {
    let response;
    try {
      response = await fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          accept: 'application/json',
        },
        redirect: 'error',
        signal,
      });
    } catch (error) {
      if (signal.aborted) {
        throw new TmdbError('timeout');
      }
      throw new TmdbError('upstream');
    }

    status = response.status;
    if (!response.ok) throw new TmdbError(classifyStatus(status), status);

    const text = await readBoundedBody(response, maxBytes, signal);
    try {
      return JSON.parse(text);
    } catch {
      throw new TmdbError('invalid-body', status);
    }
  } finally {
    clearTimeout(timeout);
    emitLog(log, route, status, startedAt);
  }
}
