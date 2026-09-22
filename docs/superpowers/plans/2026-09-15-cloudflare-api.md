# Cloudflare API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Showtime's TMDB-backed API to a hardened Cloudflare Worker while preserving the local Node proxy and every existing client response contract.

**Architecture:** Extract request validation, TMDB fetching, and response mapping into runtime-neutral ES modules used by both the existing Node HTTP adapter and a new module-format Worker. Keep Cloudflare-specific CORS, rate-limit bindings, Cache API use, request IDs, and structured logging in focused Worker modules so the shared core remains independently testable.

**Tech Stack:** JavaScript ES modules, TypeScript for the Worker boundary, Node test runner for shared/Node contracts, Cloudflare Workers, Wrangler 4.132.0, Vitest 4.1.0, `@cloudflare/vitest-plugin` 1.1.10

**Spec:** `docs/superpowers/specs/2026-09-14-cloudflare-api-design.md`

## Global Constraints

- The public API is limited to `GET /search`, `GET /discovery`, the four approved `/details/*` route shapes, and required `OPTIONS` preflights.
- The complete request URL is at most 2,048 bytes; search text is 1-100 trimmed characters; IDs and season numbers are canonical positive safe integers.
- `TMDB_READ_ACCESS_TOKEN` remains server-side and is declared under `secrets.required`; `.dev.vars*` and `.env*` remain ignored.
- TMDB requests use the fixed `https://api.themoviedb.org` origin, `redirect: "error"`, bounded timeouts, a 4 MiB response-body limit, and no forwarding of upstream bodies or headers.
- Worker responses always include JSON content type, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and an internally generated `X-Request-ID`; errors use `Cache-Control: no-store`.
- Production CORS uses an explicit origin allowlist and adds origin-specific headers only after cache lookup; cached responses never contain CORS headers.
- Search is not edge-cached. Discovery is cached for 30 minutes; valid title, person, and season details are cached for 10 minutes; errors are never cached.
- Per-client one-minute limits are 30 search, 30 discovery, and 20 details requests, plus a 100-unit work budget where search/season/person cost 1, discovery 2, movie details 4, and TV details 5.
- `preview_urls` is false. Workers observability stays enabled for sanitized custom events while `observability.logs.invocation_logs` is false.
- No deployment or client cutover occurs until all spec no-go checks pass and Cloudflare account recovery plus MFA are confirmed by the user.

---

### Task 1: Deployable top-level Worker foundation

**Files:**
- Create: `worker/.gitignore`
- Create: `worker/package.json`
- Create: `worker/package-lock.json`
- Create: `worker/wrangler.jsonc`
- Create: `worker/tsconfig.json`
- Create: `worker/vitest.config.ts`
- Create: `worker/src/index.ts`
- Create: `worker/test/index.spec.ts`

**Interfaces:**
- Consumes: none
- Produces: a self-contained top-level Worker project whose root response is `Showtime API is live`, plus `npm test`, `npm run typecheck`, and `npm run check` scripts

- [ ] **Step 1: Write the failing configuration and smoke tests**

```ts
// worker/test/index.spec.ts
import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("Showtime Worker foundation", () => {
  it("returns the deployment smoke response", async () => {
    const response = await exports.default.fetch("https://showtime.test/");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Showtime API is live");
  });
});
```

- [ ] **Step 2: Run the smoke test and verify the Worker harness is absent**

Run from `worker/`: `npm test -- --run test/index.spec.ts`

Expected: FAIL because the Worker test script, configuration, and entrypoint do not exist.

- [ ] **Step 3: Create the package manifest and install the pinned Worker toolchain**

Create `worker/package.json` first:

```json
{
  "name": "showtime-api-worker",
  "private": true,
  "type": "module",
  "scripts": {
    "types": "wrangler types src/worker-configuration.d.ts",
    "test": "vitest --config vitest.config.ts",
    "typecheck": "tsc --project tsconfig.json --noEmit",
    "check": "npm run types && npm run typecheck && npm test -- --run",
    "deploy": "wrangler deploy"
  }
}
```

Run from `worker/`: `npm install --save-dev --save-exact wrangler@4.132.0 vitest@4.1.0 @cloudflare/vitest-plugin@1.1.10 typescript@6.0.3`

Expected: `package.json` and `package-lock.json` contain exact versions and npm reports no unexplained install scripts or critical vulnerabilities. Stop and investigate any critical finding before continuing.

- [ ] **Step 4: Add ignores and a source-of-truth Wrangler configuration**

Append to `worker/.gitignore`:

```gitignore
.dev.vars
.dev.vars.*
.env
.env.*
!.env.example
.wrangler/
worker-dist/
```

Create `worker/wrangler.jsonc`:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "showtime-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-09-15",
  "workers_dev": true,
  "preview_urls": false,
  "observability": {
    "enabled": true,
    "logs": { "invocation_logs": false }
  }
}
```

Create `worker/tsconfig.json` and `worker/vitest.config.ts`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "types": ["@cloudflare/vitest-plugin/types"],
    "allowJs": true,
    "checkJs": false
  },
  "include": ["src/**/*.ts", "src/**/*.mjs", "test/**/*.ts"]
}
```

```ts
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
});
```

- [ ] **Step 5: Implement the temporary deployment smoke response**

```ts
export default {
  async fetch(): Promise<Response> {
    return new Response("Showtime API is live");
  },
};
```

- [ ] **Step 6: Generate types and run the complete foundation check**

Run from `worker/`: `npm run check`

Run from `worker/`: `npx wrangler deploy --dry-run --outdir worker-dist`

Expected: typecheck and smoke test PASS, and Wrangler produces a deployable bundle without contacting or changing the Cloudflare account. Secret and rate-limit bindings are intentionally added in later tasks before the TMDB proxy exists.

- [ ] **Step 7: Commit the foundation**

```bash
git add worker
git commit -m "build: add Cloudflare Worker foundation"
```

### Task 2: Strict runtime-neutral request routing

**Files:**
- Create: `worker/src/api/request.mjs`
- Create: `worker/src/api/request.test.mjs`
- Modify: `worker/package.json`

**Interfaces:**
- Consumes: a standard `Request` or `{ method, url }` equivalent
- Produces: `parseApiRequest({ method, url }): { ok: true, route: ApiRoute } | { ok: false, status: number, body: { error: string }, allow?: string }`; `ApiRoute` contains `kind`, `cacheKey`, `cost`, and validated route fields

- [ ] **Step 1: Write table-driven failures and accepted-route tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseApiRequest } from './request.mjs';

test('accepts only canonical API routes and query shapes', () => {
  assert.deepEqual(parseApiRequest({ method: 'GET', url: 'https://api.test/search?query=%20Batman%20' }).route,
    { kind: 'search', query: 'Batman', cacheKey: '/search?query=Batman', cost: 1 });
  assert.equal(parseApiRequest({ method: 'GET', url: 'https://api.test/discovery' }).route.kind, 'discovery');
  assert.equal(parseApiRequest({ method: 'GET', url: 'https://api.test/details/movie/272' }).route.id, 272);
  assert.equal(parseApiRequest({ method: 'GET', url: 'https://api.test/details/tv/1396/season/1' }).route.seasonNumber, 1);
});

test('rejects ambiguous, noncanonical, oversized, and unsupported requests before work', () => {
  for (const url of [
    'https://api.test/search',
    'https://api.test/search?query=a&query=b',
    'https://api.test/search?query=a&extra=b',
    'https://api.test/discovery?extra=b',
    'https://api.test/details/movie/01',
    'https://api.test/details/tv/1/season/0',
    'https://api.test/details/%2e%2e/search',
  ]) assert.notEqual(parseApiRequest({ method: 'GET', url }).ok, true, url);
  assert.equal(parseApiRequest({ method: 'POST', url: 'https://api.test/search?query=a' }).status, 405);
  assert.equal(parseApiRequest({ method: 'GET', url: `https://api.test/search?query=${'a'.repeat(2050)}` }).status, 414);
});
```

- [ ] **Step 2: Run the request tests and verify failure**

Run from `worker/`: `node --test src/api/request.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` or a missing `parseApiRequest` export.

- [ ] **Step 3: Implement `parseApiRequest` as a closed route parser**

Implement explicit matches for search, discovery, movie details, TV details, season details, and person details. Use `new TextEncoder().encode(url).byteLength` for the 2,048-byte limit, `URLSearchParams.getAll()` for repeated-query rejection, `/^[1-9]\d*$/` plus `Number.isSafeInteger` for IDs, and return the exact route costs from the global constraints. `OPTIONS` may parse only approved route paths and must never become an upstream route.

```js
export function parseApiRequest({ method, url }) {
  if (new TextEncoder().encode(url).byteLength > 2048) return failure(414, 'Request URL is too long.');
  const incoming = new URL(url);
  if (!['GET', 'OPTIONS'].includes(method)) return { ...failure(405, 'Use GET.'), allow: 'GET, OPTIONS' };
  // Match each complete pathname, validate its complete query set, and return a frozen route object.
  return failure(404, 'Not found.');
}
```

- [ ] **Step 4: Run route tests and the existing Node proxy suite**

Run from `worker/`: `node --test src/api/request.test.mjs ../mobile/server/*.test.mjs`

Expected: PASS; the new parser is isolated and existing behavior is unchanged.

- [ ] **Step 5: Add the shared API tests to the main test script and commit**

Add `"api:test": "node --test src/api/*.test.mjs"` to `worker/package.json`, prepend `npm run api:test &&` to its `check` script, run `npm run api:test`, then:

```bash
git add worker/src/api/request.mjs worker/src/api/request.test.mjs worker/package.json
git commit -m "feat: add strict shared API routing"
```

### Task 3: Hardened TMDB transport and bounded JSON reader

**Files:**
- Create: `worker/src/api/tmdb.mjs`
- Create: `worker/src/api/tmdb.test.mjs`

**Interfaces:**
- Consumes: `fetchTmdbJson({ endpoint, route, token, fetchImpl, timeoutMs, maxBytes, log })`
- Produces: validated JSON value or `TmdbError` with `kind: 'not-found' | 'throttled' | 'upstream' | 'timeout' | 'invalid-body' | 'too-large'`; never returns an upstream body or header

- [ ] **Step 1: Write failing transport security tests**

```js
test('constructs only fixed-origin URLs and rejects redirects', async () => {
  const calls = [];
  await fetchTmdbJson({ endpoint: '/3/movie/1', route: 'movie-details', token: 'canary-secret',
    fetchImpl: async (url, init) => { calls.push([String(url), init]); return Response.json({ id: 1 }); } });
  assert.equal(calls[0][0], 'https://api.themoviedb.org/3/movie/1');
  assert.equal(calls[0][1].redirect, 'error');
  await assert.rejects(() => fetchTmdbJson({ endpoint: 'https://evil.test/', route: 'movie-details', token: 'x', fetchImpl: fetch }));
});

test('rejects declared and streamed bodies above 4 MiB', async () => {
  await assert.rejects(() => fetchTmdbJson({ endpoint: '/3/movie/1', route: 'movie-details', token: 'x',
    fetchImpl: async () => new Response('{}', { headers: { 'Content-Length': String(4 * 1024 * 1024 + 1) } }) }),
    (error) => error.kind === 'too-large');
});
```

Add cases for timeout/abort, 404, 429, malformed JSON, a stream crossing 4 MiB, and logging that contains route template/status/duration but not token, URL query, or body.

- [ ] **Step 2: Run the transport test and verify failure**

Run from `worker/`: `node --test src/api/tmdb.test.mjs`

Expected: FAIL because `tmdb.mjs` is absent.

- [ ] **Step 3: Implement fixed-origin fetch and a streaming size cap**

```js
const TMDB_ORIGIN = 'https://api.themoviedb.org';
const MAX_BODY_BYTES = 4 * 1024 * 1024;

export async function fetchTmdbJson({ endpoint, route, token, fetchImpl = fetch, timeoutMs = 10000,
  maxBytes = MAX_BODY_BYTES, log = () => {} }) {
  if (!endpoint.startsWith('/3/') || /[\\\u0000-\u001f]/.test(endpoint)) {
    throw new TypeError('Invalid TMDB endpoint');
  }
  const url = new URL(endpoint, TMDB_ORIGIN);
  if (url.origin !== TMDB_ORIGIN || url.username || url.password) throw new TypeError('Invalid TMDB origin');
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  });
  // Classify status, reject oversized Content-Length, read chunks with a running byte count,
  // decode once, parse JSON, and log only the supplied route template, status, and duration.
}
```

- [ ] **Step 4: Run transport and leak tests**

Run from `worker/`: `node --test src/api/tmdb.test.mjs ../mobile/server/*.test.mjs`

Expected: PASS, including token-shaped canary assertions.

- [ ] **Step 5: Commit the transport boundary**

```bash
git add worker/src/api/tmdb.mjs worker/src/api/tmdb.test.mjs
git commit -m "feat: harden TMDB transport"
```

### Task 4: Shared search core and Node adapter migration

**Files:**
- Create: `worker/src/api/search.mjs`
- Create: `worker/src/api/search.test.mjs`
- Modify: `mobile/server/search.mjs`
- Modify: `mobile/server/search.test.mjs`

**Interfaces:**
- Consumes: validated `{ kind: 'search', query, cacheKey, cost }`, token, and `fetchTmdbJson`
- Produces: `handleSearch(route, deps): Promise<{ status: number, body: SearchResponse | ErrorResponse }>`; Node `createSearchHandler` retains its public signature

- [ ] **Step 1: Move search response-contract cases into a runtime-neutral failing test**

```js
const result = await handleSearch(
  { kind: 'search', query: 'Batman', cacheKey: '/search?query=Batman', cost: 1 },
  { token: 'test-token', fetchTmdbJson: async () => ({ results: [
    { id: 1, media_type: 'person', name: 'Actor' },
    { id: 2, media_type: 'movie', title: 'Batman', release_date: '1989-06-23', poster_path: '/poster.jpg' },
  ] }) },
);
assert.deepEqual(result, { status: 200, body: { results: [
  { id: 'movie-2', title: 'Batman', year: '1989', mediaType: 'Movie', posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg' },
] } });
```

Also assert safe mappings for `not-found`/`throttled`/`upstream` transport errors and malformed payloads.

- [ ] **Step 2: Run the shared search test and verify failure**

Run from `worker/`: `node --test src/api/search.test.mjs`

Expected: FAIL because `handleSearch` is absent.

- [ ] **Step 3: Extract the search mapper and handler**

```js
export async function handleSearch(route, { token, fetchTmdbJson }) {
  if (!token) return { status: 503, body: { error: 'Search is not configured yet.' } };
  try {
    const data = await fetchTmdbJson({
      endpoint: `/3/search/multi?${new URLSearchParams({ query: route.query, include_adult: 'false', page: '1' })}`,
      route: 'search',
      token,
    });
    if (!Array.isArray(data?.results)) throw new TypeError('Invalid search response');
    return { status: 200, body: { results: mapSearchResults(data.results) } };
  } catch (error) {
    return mapSearchError(error);
  }
}
```

- [ ] **Step 4: Make the Node adapter call the shared parser and core**

Keep Node-only `writeHead`/`end` behavior and permissive development CORS in `mobile/server/search.mjs`. Import shared runtime-neutral modules from `../../worker/src/api/`, pass an absolute local base into `parseApiRequest`, then dispatch the search route through `handleSearch`; do not import Worker-specific adapters.

- [ ] **Step 5: Run shared and Node parity tests**

Run from `worker/`: `node --test src/api/search.test.mjs ../mobile/server/search.test.mjs`

Expected: PASS with byte-for-byte equivalent status/body contracts for the existing cases.

- [ ] **Step 6: Commit shared search**

```bash
git add worker/src/api/search.mjs worker/src/api/search.test.mjs mobile/server/search.mjs mobile/server/search.test.mjs
git commit -m "refactor: share search API core"
```

### Task 5: Shared discovery core with runtime-provided caching

**Files:**
- Create: `worker/src/api/discovery.mjs`
- Create: `worker/src/api/discovery.test.mjs`
- Modify: `mobile/server/discovery.mjs`
- Modify: `mobile/server/discovery.test.mjs`

**Interfaces:**
- Consumes: discovery route, token, transport, and optional local cache dependency
- Produces: `handleDiscovery(route, deps): Promise<ApiResult>`; `createMemoryCache({ now })` remains Node-only and preserves 30-minute/concurrent-request behavior

- [ ] **Step 1: Write failing shared discovery mapping tests**

Copy the bounded, deduplicated, adult-filtered movie/TV fixture from `server/discovery.test.mjs` into `api/discovery.test.mjs`. Assert that two TMDB endpoints are requested and that the result excludes all upstream-only fields.

- [ ] **Step 2: Run the shared discovery test and verify failure**

Run from `worker/`: `node --test src/api/discovery.test.mjs`

Expected: FAIL because the shared handler is absent.

- [ ] **Step 3: Extract discovery mapping while injecting cache behavior**

```js
export async function handleDiscovery(route, { token, fetchTmdbJson }) {
  if (!token) return { status: 503, body: { error: 'Discovery is not configured yet.' } };
  try {
    const [movies, tv] = await Promise.all([
      fetchTmdbJson({ endpoint: '/3/trending/movie/week?language=en-GB', route: 'discovery', token }),
      fetchTmdbJson({ endpoint: '/3/trending/tv/week?language=en-GB', route: 'discovery', token }),
    ]);
    return { status: 200, body: { movies: mapDiscoveryList(movies, 'movie'), tv: mapDiscoveryList(tv, 'tv') } };
  } catch (error) {
    return mapDiscoveryError(error);
  }
}
```

Wrap this pure handler with the existing module-memory cache only in `mobile/server/discovery.mjs`; do not put a module-global production cache in `worker/src/api/discovery.mjs`.

- [ ] **Step 4: Run discovery parity and concurrency tests**

Run from `worker/`: `node --test src/api/discovery.test.mjs ../mobile/server/discovery.test.mjs`

Expected: PASS; Node still coalesces concurrent requests and retries failures, while the shared core is cache-agnostic.

- [ ] **Step 5: Commit shared discovery**

```bash
git add worker/src/api/discovery.mjs worker/src/api/discovery.test.mjs mobile/server/discovery.mjs mobile/server/discovery.test.mjs
git commit -m "refactor: share discovery API core"
```

### Task 6: Shared details core and complete Node contract parity

**Files:**
- Create: `worker/src/api/details.mjs`
- Create: `worker/src/api/details.test.mjs`
- Modify: `mobile/server/details.mjs`
- Modify: `mobile/server/details.test.mjs`
- Modify: `mobile/server/search.mjs`

**Interfaces:**
- Consumes: validated movie/TV/season/person route plus `token`, `fetchTmdbJson`, `optionalTimeoutMs`, and sanitized `log`
- Produces: `handleDetails(route, deps): Promise<ApiResult>`; local `handleDetails` adapter retains the existing `{ pathname, method, token, fetchImpl, send, logger, optionalTimeoutMs }` interface until callers are migrated

- [ ] **Step 1: Create shared contract tests before moving implementation**

Move representative fixtures for movie, TV, season, person, cast/crew/trailer, providers, latest-season failure isolation, 404, 429, malformed upstream data, and safe errors into `api/details.test.mjs`. Call `handleDetails` with parsed route objects and an injected `fetchTmdbJson` stub; assert exact existing response bodies.

- [ ] **Step 2: Run the shared details tests and verify failure**

Run from `worker/`: `node --test src/api/details.test.mjs`

Expected: FAIL because the shared details handler is absent.

- [ ] **Step 3: Extract mapping and orchestration without changing contracts**

```js
export async function handleDetails(route, { token, fetchTmdbJson, optionalTimeoutMs = 3000 }) {
  if (!token) return { status: 503, body: { error: 'Details are not configured yet.' } };
  if (route.kind === 'person-details') return loadPerson(route, { token, fetchTmdbJson });
  if (route.kind === 'season-details') return loadSeason(route, { token, fetchTmdbJson });
  return loadTitle(route, { token, fetchTmdbJson, optionalTimeoutMs });
}
```

Keep all existing validation/mapping helpers runtime-neutral. Optional credits, videos, provider, and latest-season calls must independently catch classified failures and return empty optional fields; the required primary call must preserve safe status mapping.

- [ ] **Step 4: Reduce `server/details.mjs` to a compatibility adapter**

Parse its pathname through `parseApiRequest`, adapt the injected `fetchImpl` to `fetchTmdbJson`, call the shared handler, and pass only `{ status, body }` to `send`. Remove duplicated mapping code only after its shared counterpart passes.

- [ ] **Step 5: Run all shared and Node API tests**

Run from `worker/`: `node --test src/api/*.test.mjs ../mobile/server/*.test.mjs`

Expected: PASS, including all pre-existing detail fixtures and optional-timeout behavior.

- [ ] **Step 6: Commit shared details**

```bash
git add worker/src/api/details.mjs worker/src/api/details.test.mjs mobile/server/details.mjs mobile/server/details.test.mjs mobile/server/search.mjs
git commit -m "refactor: share details API core"
```

### Task 7: Worker dispatch, CORS, request IDs, and privacy-safe logs

**Files:**
- Create: `worker/src/response.ts`
- Create: `worker/src/cors.ts`
- Create: `worker/src/logging.ts`
- Modify: `worker/src/index.ts`
- Create: `worker/test/security.spec.ts`
- Modify: `worker/wrangler.jsonc`

**Interfaces:**
- Consumes: shared `parseApiRequest`, `handleSearch`, `handleDiscovery`, `handleDetails`; `Env.ALLOWED_ORIGINS` as a comma-separated non-secret variable supplied in test/deploy environment
- Produces: `withSecurityHeaders`, `corsHeaders`, `logEvent`, and full Worker route dispatch

- [ ] **Step 1: Write failing Worker security-boundary tests**

```ts
it.each([
  ["https://allowed.example", "https://allowed.example"],
  ["https://evil.example", null],
  [null, null],
])("applies exact CORS policy for %s", async (origin, expected) => {
  const headers = origin ? { Origin: origin } : undefined;
  const response = await exports.default.fetch("https://showtime.test/search?query=Batman", { headers });
  expect(response.headers.get("access-control-allow-origin")).toBe(expected);
  expect(response.headers.get("vary")).toContain("Origin");
});
```

Add cases for allowed/denied preflight, unsupported methods, all security headers on every status, untrusted caller request IDs, unique generated UUIDs, missing secret, and a logger spy proving the token, full URL, query text, and upstream body are absent.

- [ ] **Step 2: Run Worker security tests and verify failure**

Run from `worker/`: `npm test -- --run test/security.spec.ts`

Expected: FAIL because dispatch and security modules are absent.

- [ ] **Step 3: Implement response and CORS helpers**

```ts
export function corsHeaders(origin: string | null, allowed: ReadonlySet<string>): Headers {
  const headers = new Headers({ Vary: "Origin" });
  if (origin && allowed.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

export function jsonResponse(status: number, body: unknown, requestId: string): Response {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Request-ID": requestId,
    ...(status >= 400 ? { "Cache-Control": "no-store" } : {}),
  } });
}
```

- [ ] **Step 4: Implement route dispatch and sanitized structured events**

`worker/src/index.ts` must generate `crypto.randomUUID()`, reject disallowed browser origins before upstream work, handle allowed preflight without TMDB, dispatch parsed routes to shared handlers, and log only this shape:

```ts
type SafeEvent = {
  requestId: string;
  route: "search" | "discovery" | "movie-details" | "tv-details" | "season-details" | "person-details" | "unmatched";
  status: number;
  durationMs: number;
  cache: "hit" | "miss" | "bypass";
};
```

Use `console.log(JSON.stringify(event))`; never include the request URL, raw pathname, query, token, headers, IP, or upstream payload.

Extend `worker/wrangler.jsonc` with `secrets.required: ["TMDB_READ_ACCESS_TOKEN"]`, `vars.ALLOWED_ORIGINS: ""`, and `limits.subrequests: 8`; regenerate `Env` so deployment now fails closed when the TMDB secret is missing.

- [ ] **Step 5: Run Worker and Node regression tests**

Run from `worker/`: `npm run check`

Run from `mobile/`: `npm test`

Expected: both PASS.

- [ ] **Step 6: Commit the Worker security boundary**

```bash
git add worker/src worker/test
git commit -m "feat: add secure Worker request dispatch"
```

### Task 8: Layered abuse controls before upstream work

**Files:**
- Create: `worker/src/rate-limit.ts`
- Modify: `worker/src/index.ts`
- Create: `worker/test/rate-limit.spec.ts`
- Modify: `worker/wrangler.jsonc`

**Interfaces:**
- Consumes: parsed `ApiRoute`, `CF-Connecting-IP`, and the four generated `RateLimit` bindings
- Produces: `enforceRateLimits(route, env, clientKey): Promise<boolean>`; false returns safe 429 without core/TMDB invocation

- [ ] **Step 1: Write failing route-category and work-budget tests**

Use fake limiters that record keys and configured call counts. Assert search/discovery/details choose the matching limiter, each request charges the work limiter exactly `route.cost` times, rejection stops later calls, missing IP uses a fixed `anonymous` key, and a rejected limiter prevents the injected TMDB fetch spy from running.

```ts
const rejected = { limit: vi.fn().mockResolvedValue({ success: false }) };
const allowed = { limit: vi.fn().mockResolvedValue({ success: true }) };
expect(await enforceRateLimits(movieRoute, limiterEnv(rejected, allowed), "203.0.113.1")).toBe(false);
expect(fetchSpy).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run rate-limit tests and verify failure**

Run from `worker/`: `npm test -- --run test/rate-limit.spec.ts`

Expected: FAIL because `enforceRateLimits` is absent.

- [ ] **Step 3: Implement category and work-unit enforcement**

```ts
export async function enforceRateLimits(route: ApiRoute, env: Env, clientKey: string): Promise<boolean> {
  const category = route.kind === "search" ? env.SEARCH_LIMITER
    : route.kind === "discovery" ? env.DISCOVERY_LIMITER : env.DETAILS_LIMITER;
  if (!(await category.limit({ key: clientKey })).success) return false;
  for (let unit = 0; unit < route.cost; unit += 1) {
    if (!(await env.WORK_LIMITER.limit({ key: clientKey })).success) return false;
  }
  return true;
}
```

Document in code that IP-based, location-local, eventually consistent limits are best-effort abuse controls, not user identity or exact quota accounting.

- [ ] **Step 4: Verify rejection ordering and all suites**

Run from `worker/`: `npm run check`

Expected: PASS; tests prove validation and rate limiting precede any TMDB call.

- [ ] **Step 5: Commit abuse controls**

```bash
git add worker/src/rate-limit.ts worker/src/index.ts worker/test/rate-limit.spec.ts worker/wrangler.jsonc
git commit -m "feat: enforce Worker abuse limits"
```

### Task 9: Cloudflare edge cache without CORS contamination

**Files:**
- Create: `worker/src/cache.ts`
- Modify: `worker/src/index.ts`
- Create: `worker/test/cache.spec.ts`

**Interfaces:**
- Consumes: canonical `route.cacheKey`, `Cache`, and a callback returning the uncached core result
- Produces: `withApiCache(route, cache, load, ctx): Promise<{ result: ApiResult, outcome: 'hit' | 'miss' | 'bypass' }>`

- [ ] **Step 1: Write failing cache isolation and expiry tests**

Assert search always bypasses; discovery writes `max-age=1800`; every details kind writes `max-age=600`; only status 200 is stored; canonical keys discard incoming origin/host noise; cached payloads contain no `Access-Control-*`, `Vary`, or request ID; a hit avoids the loader; and each final response receives a fresh request ID and the current allowed origin.

```ts
const first = await withApiCache(discoveryRoute, cache, load, ctx);
const second = await withApiCache(discoveryRoute, cache, load, ctx);
expect(first.outcome).toBe("miss");
expect(second.outcome).toBe("hit");
expect(load).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: Run cache tests and verify failure**

Run from `worker/`: `npm test -- --run test/cache.spec.ts`

Expected: FAIL because `withApiCache` is absent.

- [ ] **Step 3: Implement canonical cache keys and body-only cache entries**

```ts
const CACHE_ORIGIN = "https://showtime-api.internal";

export async function withApiCache(route, cache, load, ctx) {
  const ttl = route.kind === "search" ? 0 : route.kind === "discovery" ? 1800 : 600;
  if (!ttl) return { result: await load(), outcome: "bypass" };
  const key = new Request(new URL(route.cacheKey, CACHE_ORIGIN), { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return { result: { status: hit.status, body: await hit.json() }, outcome: "hit" };
  const result = await load();
  if (result.status === 200) {
    const stored = new Response(JSON.stringify(result.body), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": `max-age=${ttl}` },
    });
    ctx.waitUntil(cache.put(key, stored));
  }
  return { result, outcome: "miss" };
}
```

- [ ] **Step 4: Run cache, security, and complete Worker checks**

Run from `worker/`: `npm run check`

Expected: PASS; tests prove no error/search/CORS/request-ID caching.

- [ ] **Step 5: Commit edge caching**

```bash
git add worker/src/cache.ts worker/src/index.ts worker/test/cache.spec.ts
git commit -m "feat: add safe Worker edge caching"
```

### Task 10: Credential scans, adversarial coverage, and local release gate

**Files:**
- Create: `worker/scripts/scan-secrets.mjs`
- Create: `worker/scripts/scan-secrets.test.mjs`
- Modify: `worker/package.json`
- Create: `worker/test/adversarial.spec.ts`
- Modify: `mobile/README.md`

**Interfaces:**
- Consumes: repository paths plus generated Expo output paths
- Produces: `npm run security:scan`; `npm run worker:release-check` as the single local no-go gate

- [ ] **Step 1: Write a failing scanner test with token-shaped canaries**

```js
test('finds canaries but ignores dependency and fixture directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'showtime-scan-'));
  await writeFile(join(root, 'bundle.js'), 'Bearer eyJhbGciOiJIUzI1NiJ9.canary.signature');
  const findings = await scanPaths([root]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].file.endsWith('bundle.js'), true);
});
```

Use only temporary test files. The scanner must never print the matched secret value, only file path, rule name, and line number.

- [ ] **Step 2: Run scanner tests and verify failure**

Run from `worker/`: `node --test scripts/scan-secrets.test.mjs`

Expected: FAIL because `scanPaths` is absent.

- [ ] **Step 3: Implement bounded source/output scanning**

Export `scanPaths(paths)` and detect TMDB variable assignments, bearer/JWT-shaped values, accidentally tracked `.dev.vars`, and known test sentinel phrases. For `--tracked`, enumerate `git ls-files` so legitimate ignored local secret files are never read; for `--generated`, scan the named Expo output. Exclude `node_modules`, `.git`, `.expo`, and documented test fixture files. Exit nonzero on a finding without printing matched content.

- [ ] **Step 4: Add adversarial Worker cases**

Cover encoded separators, double encoding, dot segments, Unicode query boundaries, repeated and unknown parameters, oversized URLs, unexpected methods/bodies, malicious origins, caller-provided request IDs, upstream redirects, declared/streamed oversized bodies, malformed JSON/schema, and token-shaped canaries in thrown errors. Every rejection must assert zero TMDB calls and safe headers/body.

- [ ] **Step 5: Add the local release-gate scripts**

```json
"worker:bundle": "wrangler deploy --dry-run --outdir worker-dist",
"security:scan": "node scripts/scan-secrets.mjs --tracked .. --generated ../mobile/dist worker-dist",
"worker:release-check": "npm --prefix ../mobile run lint && npx tsc --project ../mobile/tsconfig.json --noEmit && npm --prefix ../mobile test && npm run check && npm run worker:bundle && npm audit --audit-level=high && npm run security:scan"
```

Document that `npm --prefix ../mobile exec expo export -- --platform web` must run immediately before `security:scan` so generated browser output is included.

- [ ] **Step 6: Run the full local release gate**

Run from `worker/`: `npm --prefix ../mobile exec expo export -- --platform web`

Run: `npm run worker:release-check`

Run: `npm ls --all`

Expected: PASS with no high/critical audit finding, no credential finding, an inspected Worker bundle containing only expected application/runtime code, and a dependency tree matching the three reviewed direct Worker dev dependencies. Any failure or unexplained package/install script is a no-go and must be investigated rather than waived.

- [ ] **Step 7: Commit local security gates**

```bash
git add worker/scripts worker/package.json worker/test/adversarial.spec.ts mobile/README.md
git commit -m "test: add Cloudflare release security gate"
```

### Task 11: Operations runbook and deployment smoke tooling

**Files:**
- Create: `docs/CLOUDFLARE-RUNBOOK.md`
- Create: `worker/scripts/smoke-worker.mjs`
- Create: `worker/scripts/smoke-worker.test.mjs`
- Modify: `worker/package.json`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/DEPLOYMENT-AND-DISTRIBUTION.md`

**Interfaces:**
- Consumes: `SHOWTIME_API_URL` only; optional safe fixture IDs supplied as non-secret environment values
- Produces: `npm run worker:smoke`; exact account setup, deploy, rollback, revocation, rotation, privacy-sentinel, monitoring, and incident steps

- [ ] **Step 1: Write failing smoke-runner tests against a local fake server**

Assert the runner checks search, discovery, movie, TV, season, person, 400, 404, 405, headers, disallowed CORS, and absence of a canary in every body. Assert it refuses non-HTTPS targets except `127.0.0.1`/`localhost` and never prints response bodies or query text.

- [ ] **Step 2: Run smoke tests and verify failure**

Run from `worker/`: `node --test scripts/smoke-worker.test.mjs`

Expected: FAIL because the smoke runner is absent.

- [ ] **Step 3: Implement the safe smoke runner**

```js
const base = new URL(process.env.SHOWTIME_API_URL);
if (base.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(base.hostname)) {
  throw new Error('SHOWTIME_API_URL must use HTTPS.');
}
// Execute the fixed route table, assert status/headers/schema, and print route template + PASS/FAIL only.
```

Add `"worker:smoke": "node scripts/smoke-worker.mjs"` to `package.json`.

- [ ] **Step 4: Write the exact operational runbook**

Include these sections with executable commands and explicit stop conditions:

```bash
npm run worker:release-check
npx wrangler login
npx wrangler whoami
npx wrangler secret put TMDB_READ_ACCESS_TOKEN
npx wrangler deploy
$env:SHOWTIME_API_URL='https://showtime-api.<account-subdomain>.workers.dev'
npm run worker:smoke
npx wrangler deployments list
npx wrangler rollback <KNOWN_GOOD_VERSION_ID>
npx wrangler deployments list
```

The runbook must say that the user replaces the hostname and version ID from Wrangler output, enters the TMDB token only at the interactive prompt, confirms verified email/MFA/recovery storage before `wrangler login`, verifies `preview_urls: false` and invocation logging disabled in the dashboard, runs a unique sentinel search, checks Workers Logs/live logs/traces for absence of the sentinel, records the approved deployment ID, drills rollback, redeploys the approved version, reviews sessions/tokens, and documents token/session revocation without ever recording secret values.

- [ ] **Step 5: Verify documentation and smoke tooling locally**

Run from `worker/`: `node --test scripts/smoke-worker.test.mjs`

Run: `rg -n "TMDB_READ_ACCESS_TOKEN|preview_urls|invocation_logs|rollback|sentinel|MFA|recovery" docs/CLOUDFLARE-RUNBOOK.md worker/wrangler.jsonc`

Expected: tests PASS and every required operational gate has a concrete runbook entry.

- [ ] **Step 6: Commit operational readiness**

```bash
git add docs/CLOUDFLARE-RUNBOOK.md docs/ROADMAP.md docs/DEPLOYMENT-AND-DISTRIBUTION.md worker/scripts/smoke-worker.mjs worker/scripts/smoke-worker.test.mjs worker/package.json
git commit -m "docs: add Cloudflare operations runbook"
```

### Task 12: Account-gated deployment, rollback drill, and one-client cutover

**Files:**
- Modify: `docs/CLOUDFLARE-RUNBOOK.md`
- Create: `docs/verification/2026-09-15-cloudflare-api.md`
- Modify: `docs/ROADMAP.md`
- Modify: `mobile/.env.example`

**Interfaces:**
- Consumes: user-confirmed Cloudflare recovery/MFA, interactive Wrangler authentication, encrypted TMDB Worker secret, deployed URL
- Produces: verified `workers.dev` API URL, recorded deployment and rollback evidence, and a development-client endpoint example

- [ ] **Step 1: Stop for the account-security gate**

Ask the user to confirm all three facts before any Cloudflare write: account email is verified, MFA is enabled, and recovery codes are stored outside the repository with one supported recovery path tested. Do not infer or automate this confirmation.

- [ ] **Step 2: Authenticate and verify least-privilege ownership interactively**

Run: `npx wrangler login`

Run: `npx wrangler whoami`

Expected: the intended Cloudflare account is shown. Record only account display context needed for the runbook; do not record tokens, recovery data, or session credentials.

- [ ] **Step 3: Set the encrypted secret and deploy without client cutover**

Run: `npx wrangler secret put TMDB_READ_ACCESS_TOKEN`

Run: `npx wrangler deploy`

Expected: secret input is interactive, required-secret validation passes, the Worker deploys to its intended `workers.dev` route, and no preview URL is created.

- [ ] **Step 4: Execute hosted security, privacy, and behavior checks**

Set `SHOWTIME_API_URL` in the current shell to the exact deployed HTTPS base URL, run `npm run worker:smoke`, verify rate-limit rejection with no corresponding TMDB work event, confirm custom events contain only the safe event schema, issue a unique sentinel search, and verify the sentinel is absent from persisted logs, live logs, and traces. Exercise a real TV-details response, record its CPU time against the free-plan ceiling, and confirm the eight-subrequest deployment limit is active. Stop on any leak, unexpected 5xx, CPU-limit event, TMDB 429, unsafe CORS/cache header, or missing security header.

- [ ] **Step 5: Drill rollback and restore the approved deployment**

List deployments, record the candidate and known-good IDs in the verification document, execute `npx wrangler rollback <KNOWN_GOOD_VERSION_ID>`, rerun smoke tests, then redeploy the approved candidate and rerun smoke tests. The verification document records IDs and timestamps, never credentials or search text.

- [ ] **Step 6: Test exactly one development client against the hosted API**

Add this public-only example to `mobile/.env.example`:

```dotenv
EXPO_PUBLIC_SEARCH_API_URL=https://showtime-api.<account-subdomain>.workers.dev
```

Set the real URL only in ignored `mobile/.env.local`. Verify Search, Discover, movie, TV, season, person, provider, error, and reload flows over mobile data with the development computer switched off. Confirm no personal watchlist/progress/history/settings payload reaches the Worker.

- [ ] **Step 7: Record evidence and update only completed roadmap boxes**

Create `docs/verification/2026-09-15-cloudflare-api.md` with command results, tested route templates, header/CORS/cache/rate-limit outcomes, sanitized logging outcome, sentinel result, deployment/rollback IDs, mobile-data result, and remaining no-go items. Check only roadmap entries backed by this evidence.

- [ ] **Step 8: Run the final release gate and commit evidence**

Run: `npm run worker:release-check`

Run: `npm run worker:smoke`

Expected: both PASS against the approved live deployment.

```bash
git add mobile/.env.example docs/CLOUDFLARE-RUNBOOK.md docs/ROADMAP.md docs/verification/2026-09-15-cloudflare-api.md
git commit -m "docs: verify Cloudflare API deployment"
```
