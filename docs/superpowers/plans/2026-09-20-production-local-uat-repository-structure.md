# Production and Local/UAT Repository Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganise Showtime into explicit production and local/UAT areas around one web-first client and one shared TMDB API core, without changing or deploying the live application.

**Architecture:** `app/` holds the web-first Expo client, and `shared/tmdb-api/` holds runtime-neutral TMDB behaviour. Cloudflare adapters and deployment configuration live under `production/`; the Node development adapter and browser acceptance tooling live under `local-uat/`. Root scripts and repository tests make the environment boundary discoverable and enforceable.

**Tech Stack:** Node.js, npm, Expo SDK 57, React Native Web, TypeScript 6, Node test runner, Vitest 4, Wrangler 4.132.0, Cloudflare Workers Static Assets, Cloudflare D1

**Spec:** `docs/superpowers/specs/2026-09-20-production-local-uat-repository-structure-design.md`

## Global Constraints

- Treat `feature/cloudflare-api` as the canonical source because it matches the deployed website and API.
- The website and browser workflow are primary; retain existing Expo native compatibility as a secondary future option.
- Do not deploy either Worker during this migration.
- Preserve Worker names `showtime-web` and `showtime-api`.
- Preserve `https://showtimetracker.show`, `api.showtimetracker.show`, the existing `workers.dev` API endpoint, and the legacy web-host redirect.
- Preserve binding names, rate-limit namespace IDs, the D1 database name and ID, secret names, compatibility dates, and production API URL.
- Keep `TMDB_READ_ACCESS_TOKEN` and `RESEND_API_KEY` out of source, logs, command arguments, and generated browser output.
- Do not copy application or TMDB handler source between environments.
- Do not allow `production/` to import `local-uat/` or `local-uat/` to import `production/`.
- Do not upgrade dependencies while moving them; preserve the versions in the current lockfiles.
- Preserve the current uncommitted email-template work, the untracked root `.vscode/`, the rollback checkout, and `D:/Dev/showtime-qa`.
- Historical plans, specifications, screenshots, and dated verification records remain historical and are not mass-edited.
- Use `apply_patch` for content changes and Git-aware moves for tracked files. Before recursive moves or cleanup on Windows, resolve and verify every absolute path is inside this worktree.

## Review Focus

1. **Production bundle selects the wrong API:** the exported JavaScript must contain `https://showtime-api.showtime-workers.workers.dev` and must not contain `localhost:3001` or a TMDB credential; Task 6 adds this release test and Task 9 runs it on the generated bundle.
2. **Moved Wrangler config resolves the wrong entry point or asset directory:** both configs must preserve Worker identities and bindings, and both dry-run bundles must pass; Tasks 5 and 6 pin these contracts.
3. **Environment coupling returns through imports:** production and local/UAT source must import only the shared core, never each other; Task 7 adds a repository-wide boundary test.
4. **Ignored secrets or generated output become tracked during moves:** Task 7 asserts ignore behaviour and Task 9 checks tracked files plus the credential scan without displaying secret values.
5. **Browser navigation or canonical redirects regress:** Task 6 preserves unit coverage for deep links and the legacy hostname, and Task 9 checks the live canonical root, a deep route, the API, and the legacy hostname without deploying.

---

### Task 1: Protect the existing email-template work and capture a baseline

**Files:**
- Modify: `worker/src/email.ts` (existing user change only)
- Modify: `worker/test/email.spec.ts` (existing user change only)
- Inspect: all tracked and untracked worktree paths

**Interfaces:**
- Consumes: the current dirty `feature/cloudflare-api` worktree
- Produces: a dedicated tested commit for the existing branded-email change, leaving only generated/editor files untracked before structural moves

- [ ] **Step 1: Record the exact dirty state without printing secret files**

Run from the repository root:

```powershell
git status --short
git diff -- worker/src/email.ts worker/test/email.spec.ts
git diff --name-only
```

Expected: only `worker/src/email.ts` and `worker/test/email.spec.ts` are modified tracked files; `.vscode/` and `worker/.wrangler-dry-run/` remain untracked. Do not read `mobile/.env.local` or `worker/.dev.vars`.

- [ ] **Step 2: Run the focused email test before preserving the change**

Run:

```powershell
npm --prefix worker test -- --run test/email.spec.ts
```

Expected: the email-template tests pass and verify the `SHOWTIME` name and `TRACK • WATCH • DISCOVER` tagline.

- [ ] **Step 3: Run the complete pre-migration baseline**

Run:

```powershell
npm --prefix mobile test
npm --prefix mobile run lint
npm --prefix mobile exec tsc -- --noEmit
npm --prefix worker run check
npm --prefix worker run bundle
```

Expected: all commands exit 0. If a command fails, record its exact command and output before deciding whether the failure predates the migration; do not mask it with structural changes.

- [ ] **Step 4: Commit only the existing email work**

```powershell
git add worker/src/email.ts worker/test/email.spec.ts
git diff --cached --check
git commit -m "style: brand account emails"
```

Expected: the commit contains exactly those two files. `.vscode/`, `.wrangler-dry-run/`, `.env.local`, and `.dev.vars` remain untracked or ignored.

---

### Task 2: Extract the shared TMDB API core

**Files:**
- Create by move: `shared/tmdb-api/details.mjs`
- Create by move: `shared/tmdb-api/discovery.mjs`
- Create by move: `shared/tmdb-api/request.mjs`
- Create by move: `shared/tmdb-api/search.mjs`
- Create by move: `shared/tmdb-api/tmdb.mjs`
- Create by move: `shared/tmdb-api/*.test.mjs`
- Modify: `worker/src/index.ts`
- Modify: `worker/package.json`
- Modify: `worker/tsconfig.json`
- Modify: `mobile/server/search.mjs`
- Modify: `mobile/server/details.mjs`
- Modify: `mobile/server/discovery.mjs`

**Interfaces:**
- Consumes: `parseApiRequest`, `handleSearch`, `handleDiscovery`, `handleDetails`, and `fetchTmdbJson` from the existing `worker/src/api/*.mjs`
- Produces: the same named exports from `shared/tmdb-api/*.mjs`, with Node and Cloudflare adapters importing that neutral location

- [ ] **Step 1: Run the shared handler tests from their current location**

```powershell
node --test worker/src/api/*.test.mjs
```

Expected: all parsing, TMDB transport, search, discovery, and details tests pass before the move.

- [ ] **Step 2: Move the neutral modules and their tests with history**

Create `shared/tmdb-api/`, then use `git mv` for these exact pairs:

```text
worker/src/api/details.mjs          -> shared/tmdb-api/details.mjs
worker/src/api/details.test.mjs     -> shared/tmdb-api/details.test.mjs
worker/src/api/discovery.mjs        -> shared/tmdb-api/discovery.mjs
worker/src/api/discovery.test.mjs   -> shared/tmdb-api/discovery.test.mjs
worker/src/api/request.mjs          -> shared/tmdb-api/request.mjs
worker/src/api/request.test.mjs     -> shared/tmdb-api/request.test.mjs
worker/src/api/search.mjs           -> shared/tmdb-api/search.mjs
worker/src/api/search.test.mjs      -> shared/tmdb-api/search.test.mjs
worker/src/api/tmdb.mjs             -> shared/tmdb-api/tmdb.mjs
worker/src/api/tmdb.test.mjs        -> shared/tmdb-api/tmdb.test.mjs
```

Leave `worker/src/api/auth.ts` and `worker/src/api/sync.ts` in the production adapter; they depend on D1 and accounts.

- [ ] **Step 3: Update adapter imports to the shared core**

In `worker/src/index.ts`, replace the five imports with:

```ts
import { parseApiRequest } from "../../shared/tmdb-api/request.mjs";
import { handleDetails } from "../../shared/tmdb-api/details.mjs";
import { handleDiscovery } from "../../shared/tmdb-api/discovery.mjs";
import { handleSearch } from "../../shared/tmdb-api/search.mjs";
import { fetchTmdbJson } from "../../shared/tmdb-api/tmdb.mjs";
```

In the three `mobile/server/*.mjs` adapters, replace `../../worker/src/api/<name>.mjs` with `../../shared/tmdb-api/<name>.mjs`. Do not change request or response behaviour.

- [ ] **Step 4: Point package and TypeScript checks at the shared tests**

Set the Worker package script to:

```json
"api:test": "node --test ../shared/tmdb-api/*.test.mjs"
```

Add the shared modules to `worker/tsconfig.json`:

```json
"include": ["src/**/*.ts", "src/**/*.mjs", "test/**/*.ts", "../shared/tmdb-api/**/*.mjs"]
```

- [ ] **Step 5: Verify both adapters against the one shared implementation**

```powershell
node --test shared/tmdb-api/*.test.mjs
node --test mobile/server/*.test.mjs
npm --prefix worker run check
npm --prefix worker run bundle
rg -n "worker/src/api|mobile/server" shared worker/src mobile/server
```

Expected: all tests and the Worker dry-run pass; the final search returns no cross-environment import from the shared directory.

- [ ] **Step 6: Commit the shared-core extraction**

```powershell
git add shared/tmdb-api worker/src/index.ts worker/package.json worker/tsconfig.json mobile/server
git diff --cached --check
git commit -m "refactor: share TMDB API core"
```

---

### Task 3: Move the web-first client from `mobile/` to `app/`

**Files:**
- Create by move: `app/assets/**`
- Create by move: `app/src/app/**`
- Create by move: `app/src/components/**`
- Create by move: `app/src/constants/**`
- Create by move: `app/src/hooks/**`
- Create by move: `app/src/services/**`
- Create by move: `app/src/global.css`
- Create by move: `app/src/global.d.ts`
- Create by move: `app/tests/**` except production web tests
- Create by move: `app/app.json`
- Create by move: `app/eslint.config.js`
- Create by move: `app/tsconfig.json`
- Create by move: `app/package.json`
- Create by move: `app/package-lock.json`
- Create by move: `app/.gitignore`, `app/.vscode/**`, `app/LICENSE`, `app/README.md`
- Modify: `app/package.json`
- Modify: `app/package-lock.json`

**Interfaces:**
- Consumes: the current Expo Router entry point and `EXPO_PUBLIC_SEARCH_API_URL` selection in `src/services/server-url.ts`
- Produces: package `showtime-app` with unchanged application imports and routes, browser-first scripts, and optional native scripts

- [ ] **Step 1: Add a package-level check before the move**

Update the package scripts during the move so the final `app/package.json` contains:

```json
{
  "name": "showtime-app",
  "scripts": {
    "test": "node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/*.test.mjs",
    "start": "expo start",
    "web": "expo start --web",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "lint": "expo lint",
    "typecheck": "tsc --noEmit",
    "check": "npm run lint && npm run typecheck && npm test && expo install --check",
    "test:history": "node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/search-history-rules.test.mjs",
    "test:watchlist": "node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/watchlist-rules.test.mjs",
    "test:tracking": "node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/air-date-rules.test.mjs tests/tv-progress-rules.test.mjs tests/watchlist-progress.test.mjs",
    "test:home": "node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/recently-viewed-rules.test.mjs tests/home-data.test.mjs tests/continue-watching.test.mjs",
    "test:movies": "node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/movie-progress-rules.test.mjs"
  }
}
```

Keep every current dependency and devDependency at its existing version. Remove only the local-server and production-release scripts from this package.

- [ ] **Step 2: Move only shared client files**

Use Git-aware moves for the listed paths. Keep these environment-specific files temporarily under `mobile/` for Tasks 4 and 6:

```text
mobile/server/**
mobile/scripts/export-web.mjs
mobile/scripts/scan-secrets.mjs
mobile/scripts/scan-secrets.test.mjs
mobile/scripts/search-tmdb.mjs
mobile/scripts/smoke-worker.mjs
mobile/scripts/smoke-worker.test.mjs
mobile/src/web-worker.ts
mobile/tests/web-deployment.test.mjs
mobile/tests/web-worker.test.mjs
mobile/wrangler.jsonc
mobile/.env.example
```

Move `mobile/node_modules/` to `app/node_modules/` only after verifying both resolved paths are inside the current worktree and the destination does not exist. It remains ignored and must not be staged.

- [ ] **Step 3: Update package identity without changing the public application identity**

Set `package.json` and the lockfile root package name to `showtime-app`. Keep the Expo `name`, `slug`, scheme, routes, assets, SDK, and dependency versions unchanged because changing public/native identity is outside this migration.

Run:

```powershell
npm --prefix app install --package-lock-only --ignore-scripts
```

Expected: only package metadata and paths change; dependency versions remain pinned.

- [ ] **Step 4: Verify the moved client**

```powershell
npm --prefix app run check
npm --prefix app exec expo export -- --platform web --output-dir dist-structure-check --clear
```

Expected: app tests, lint, TypeScript, Expo dependency validation, and a browser export pass. `app/dist-structure-check/` is generated and ignored or removed after verification.

- [ ] **Step 5: Commit the client move**

```powershell
git add app mobile
git diff --cached --check
git commit -m "refactor: move web-first client into app"
```

Expected: Git detects moves for client files; environment-specific files remain under `mobile/` for the next tasks.

---

### Task 4: Create the local/UAT area

**Files:**
- Create by move: `local-uat/api/start.mjs`
- Create by move: `local-uat/api/search.mjs`
- Create by move: `local-uat/api/details.mjs`
- Create by move: `local-uat/api/discovery.mjs`
- Create by move: `local-uat/api/*.test.mjs`
- Create by move: `local-uat/api/search-tmdb.mjs`
- Create by move: `local-uat/.env.example`
- Create: `local-uat/README.md`
- Create: `local-uat/qa/README.md`
- Preserve by ignored move: `local-uat/.env.local`

**Interfaces:**
- Consumes: `shared/tmdb-api/*`, `TMDB_READ_ACCESS_TOKEN`, optional `EXPO_PUBLIC_SEARCH_API_URL`, and port 3001
- Produces: a local-only HTTP service with the same endpoints and permissive development CORS; no deploy command

- [ ] **Step 1: Move the local proxy and direct TMDB diagnostic**

Move `mobile/server/*` to `local-uat/api/`, `mobile/scripts/search-tmdb.mjs` to `local-uat/api/search-tmdb.mjs`, and `mobile/.env.example` to `local-uat/.env.example`.

Before moving the ignored secret file, verify:

```powershell
$repo = (Resolve-Path .).Path
$source = (Resolve-Path mobile/.env.local).Path
$destination = [IO.Path]::GetFullPath((Join-Path $repo 'local-uat/.env.local'))
if (-not $source.StartsWith($repo, [StringComparison]::OrdinalIgnoreCase)) { throw 'Source escaped worktree' }
if (-not $destination.StartsWith($repo, [StringComparison]::OrdinalIgnoreCase)) { throw 'Destination escaped worktree' }
if (Test-Path -LiteralPath $destination) { throw 'Destination secret already exists' }
Move-Item -LiteralPath $source -Destination $destination
```

Never display or stage the file.

- [ ] **Step 2: Update local paths and messages**

In `local-uat/api/start.mjs`, load:

```js
loadEnvFile(fileURLToPath(new URL('../.env.local', import.meta.url)));
```

Use these exact safe messages:

```js
console.error('Create local-uat/.env.local from local-uat/.env.example first.');
console.error('Add TMDB_READ_ACCESS_TOKEN to local-uat/.env.local.');
```

Update `search-tmdb.mjs` to load `../.env.local`, refer to `local-uat/.env.local`, and suggest this root command:

```text
npm run local:tmdb -- "Batman"
```

The adapter imports remain `../../shared/tmdb-api/<module>.mjs` from `local-uat/api/`.

- [ ] **Step 3: Document local/UAT as browser-first and non-deployable**

Write `local-uat/README.md` with these sections and facts:

```text
# Local / UAT
## Purpose — browser-first development and acceptance testing before production
## Setup — copy .env.example to .env.local and set only the server-side TMDB token
## Run — npm run local, or local:api and local:web in separate terminals
## Test — npm run local:test and npm run app:check
## Boundaries — imports shared/tmdb-api; never deploy this Node server
## UAT status — local only; no remote UAT domain, secrets, or D1 database
```

Write `local-uat/qa/README.md` stating that only maintained current-browser checks belong there and that `D:/Dev/showtime-qa` is intentionally not imported.

- [ ] **Step 4: Verify local behaviour after the move**

```powershell
node --test shared/tmdb-api/*.test.mjs local-uat/api/*.test.mjs
rg -n "worker/src/api|production/" local-uat shared
git check-ignore -v local-uat/.env.local
```

Expected: tests pass, no local-to-production import exists, and the local secret is ignored.

- [ ] **Step 5: Commit the local/UAT area**

```powershell
git add local-uat mobile
git diff --cached --check
git commit -m "refactor: separate local UAT tooling"
```

---

### Task 5: Move the production API Worker

**Files:**
- Create by move: `production/api/migrations/**`
- Create by move: `production/api/src/**`
- Create by move: `production/api/test/**`
- Create by move: `production/api/package.json`
- Create by move: `production/api/package-lock.json`
- Create by move: `production/api/tsconfig.json`
- Create by move: `production/api/vitest.config.ts`
- Create by move: `production/api/wrangler.jsonc`
- Create by move: `production/api/.gitignore`
- Preserve by ignored move: `production/api/.dev.vars`

**Interfaces:**
- Consumes: `shared/tmdb-api/*`, D1 binding `SHOWTIME_DB`, Worker secrets, rate-limit bindings, and the exact production origin
- Produces: Worker `showtime-api` with unchanged routes, bindings, account behaviour, sync behaviour, and deployment command

- [ ] **Step 1: Add a configuration identity assertion before moving**

Add `worker/test/config.spec.ts`. Read the JSONC as text so comments and `https://` values are not corrupted by an unsafe comment-stripping parser:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("production API configuration", () => {
  it("preserves deployed resource identities", async () => {
    const config = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
    expect(config).toMatch(/"name"\s*:\s*"showtime-api"/);
    expect(config).toMatch(/"main"\s*:\s*"src\/index\.ts"/);
    expect(config).toMatch(/"pattern"\s*:\s*"api\.showtimetracker\.show"/);
    expect(config).toMatch(/"custom_domain"\s*:\s*true/);
    expect(config).toMatch(/"ALLOWED_ORIGINS"\s*:\s*"https:\/\/showtimetracker\.show"/);
    expect(config).toMatch(/"binding"\s*:\s*"SHOWTIME_DB"/);
    expect(config).toMatch(/"database_name"\s*:\s*"showtime-db"/);
    expect(config).toMatch(/"database_id"\s*:\s*"26791329-ad1c-44f3-bcbd-c0340c979e41"/);
  });
});
```

Run it against the old path and confirm it passes before the move.

- [ ] **Step 2: Move tracked Worker files with history**

Create `production/api/` and move every remaining tracked file under `worker/` there. Do not move `.wrangler/`, `.wrangler-dry-run/`, `worker-dist/`, or `node_modules/` as tracked content.

Move ignored `worker/.dev.vars` to `production/api/.dev.vars` only after resolving both absolute paths inside the worktree and confirming the destination is absent. Move `worker/node_modules/` to `production/api/node_modules/` using the same checks, or run `npm ci` in the destination if a move is not safe. Never print `.dev.vars`.

- [ ] **Step 3: Update shared imports and checks for the new depth**

In `production/api/src/index.ts`, use:

```ts
import { parseApiRequest } from "../../../shared/tmdb-api/request.mjs";
import { handleDetails } from "../../../shared/tmdb-api/details.mjs";
import { handleDiscovery } from "../../../shared/tmdb-api/discovery.mjs";
import { handleSearch } from "../../../shared/tmdb-api/search.mjs";
import { fetchTmdbJson } from "../../../shared/tmdb-api/tmdb.mjs";
```

Set package and TypeScript paths to:

```json
"api:test": "node --test ../../shared/tmdb-api/*.test.mjs"
```

```json
"include": ["src/**/*.ts", "src/**/*.mjs", "test/**/*.ts", "../../shared/tmdb-api/**/*.mjs"]
```

Update the configuration test to read `production/api/wrangler.jsonc`. Keep all JSONC values unchanged.

- [ ] **Step 4: Regenerate types and verify packaging from the final directory**

```powershell
npm --prefix production/api run api:test
npm --prefix production/api run types
npm --prefix production/api run typecheck
npm --prefix production/api test -- --run
npm --prefix production/api run bundle
npm --prefix production/api audit --audit-level=high
```

Expected: all commands exit 0, `production/api/worker-dist/` is generated and ignored, and the generated types still contain the same bindings.

- [ ] **Step 5: Commit the production API move**

```powershell
git add production/api worker
git diff --cached --check
git commit -m "refactor: separate production API worker"
```

Expected: the branded email source and test move intact in Git history.

---

### Task 6: Create the production web package and release workflow

**Files:**
- Create by move: `production/web/src/worker.ts`
- Create by move: `production/web/wrangler.jsonc`
- Create by move: `production/web/scripts/export-web.mjs`
- Create by move: `production/web/scripts/scan-secrets.mjs`
- Create by move: `production/web/scripts/scan-secrets.test.mjs`
- Create by move: `production/web/scripts/smoke-worker.mjs`
- Create by move: `production/web/scripts/smoke-worker.test.mjs`
- Create by move: `production/web/test/web-deployment.test.mjs`
- Create by move: `production/web/test/web-worker.test.mjs`
- Create: `production/web/package.json`
- Create: `production/web/package-lock.json`
- Create: `production/web/.gitignore`
- Create: `production/README.md`

**Interfaces:**
- Consumes: the `app/` Expo client and `EXPO_PUBLIC_SEARCH_API_URL`
- Produces: `production/web/dist/`, Worker `showtime-web`, a production release gate, a remote smoke command, and the legacy-host redirect

- [ ] **Step 1: Move the production web files**

Move the remaining web Worker, config, release scripts, and production-specific tests from `mobile/` into the exact paths above. Rename only `src/web-worker.ts` to `production/web/src/worker.ts`; preserve its logic.

- [ ] **Step 2: Create the pinned production web package**

Create `production/web/package.json`:

```json
{
  "name": "showtime-web-worker",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/export-web.mjs",
    "test": "node --no-warnings=ExperimentalWarning --experimental-strip-types --test test/*.test.mjs scripts/*.test.mjs",
    "bundle": "wrangler deploy --dry-run --outdir worker-dist",
    "security:scan": "node scripts/scan-secrets.mjs --tracked dist ../api/worker-dist",
    "smoke": "node scripts/smoke-worker.mjs",
    "check": "npm run build && npm test && npm run bundle && npm audit --audit-level=high && npm run security:scan",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "wrangler": "4.132.0"
  }
}
```

Create its lockfile with:

```powershell
npm --prefix production/web install --package-lock-only --ignore-scripts
npm --prefix production/web ci
```

- [ ] **Step 3: Update the web build wrapper for the shared app and owned output**

Replace the path setup in `production/web/scripts/export-web.mjs` with:

```js
const productionApiUrl = 'https://showtime-api.showtime-workers.workers.dev';
const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(webRoot, '..', '..');
const appRoot = path.join(repositoryRoot, 'app');
const outputRoot = path.join(webRoot, 'dist');
const expoCli = path.join(appRoot, 'node_modules', 'expo', 'bin', 'cli');

const result = spawnSync(process.execPath, [
  expoCli,
  'export',
  '--platform', 'web',
  '--clear',
  '--output-dir', outputRoot,
], {
  cwd: appRoot,
  env: { ...process.env, EXPO_PUBLIC_SEARCH_API_URL: productionApiUrl },
  stdio: 'inherit',
});
```

Keep the existing error and exit-code handling.

- [ ] **Step 4: Preserve the Static Assets Worker contract at the new path**

Set `production/web/wrangler.jsonc` to:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "showtime-web",
  "main": "src/worker.ts",
  "compatibility_date": "2026-09-16",
  "workers_dev": true,
  "preview_urls": false,
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "run_worker_first": true,
    "not_found_handling": "single-page-application"
  }
}
```

Create `.gitignore` with:

```gitignore
node_modules/
dist/
worker-dist/
.wrangler/
.wrangler-dry-run/
```

- [ ] **Step 5: Make the secret scan operate from the Git root**

Change `trackedFiles` in `production/web/scripts/scan-secrets.mjs` to locate the repository before listing files:

```js
async function trackedFiles(start) {
  const { stdout: repositoryRoot } = await execFileAsync(
    'git', ['-C', start, 'rev-parse', '--show-toplevel'],
  );
  const root = repositoryRoot.trim();
  const { stdout } = await execFileAsync('git', ['-C', root, 'ls-files']);
  return stdout.split(/\r?\n/).filter(Boolean).map((file) => join(root, file));
}
```

Export `trackedFiles` and add this test to `scan-secrets.test.mjs`:

```js
test('resolves tracked files from the repository root', async () => {
  const files = await trackedFiles(import.meta.dirname);
  assert.equal(files.some((file) => file.endsWith('AGENTS.md')), true);
  assert.equal(files.some((file) => file.includes('node_modules')), false);
});
```

- [ ] **Step 6: Make remote smoke requests use the allowed production origin**

Add to `smoke-worker.mjs`:

```js
export function validateOrigin(value) {
  const origin = new URL(value).origin;
  if (!origin.startsWith('https://')) throw new Error('SHOWTIME_FRONTEND_ORIGIN must use HTTPS.');
  return origin;
}
```

Pass an `origin` argument through `runSmoke(base, origin)` and `check(base, route, expectedStatus, origin, options)`. Use the validated origin in the request headers. The CLI entry point uses:

```js
const origin = validateOrigin(
  process.env.SHOWTIME_FRONTEND_ORIGIN ?? 'https://showtimetracker.show',
);
await runSmoke(validateBase(process.env.SHOWTIME_API_URL), origin);
```

Update the unit test to pass `https://showtimetracker.show`, assert HTTP origins are rejected, and keep the explicit `https://evil.example` denial check.

- [ ] **Step 7: Rewrite production web contract tests for final paths**

The deployment test must read `app/app.json`, `production/web/package.json`, the web Wrangler config as JSON, the API Wrangler config as text, and `export-web.mjs`. Assert:

```js
assert.equal(app.expo.web.output, 'single');
assert.equal(webPackage.scripts.build, 'node scripts/export-web.mjs');
assert.equal(webConfig.name, 'showtime-web');
assert.equal(webConfig.main, 'src/worker.ts');
assert.deepEqual(webConfig.assets, {
  directory: './dist',
  binding: 'ASSETS',
  run_worker_first: true,
  not_found_handling: 'single-page-application',
});
assert.match(apiConfigText, /"name"\s*:\s*"showtime-api"/);
assert.match(apiConfigText, /"ALLOWED_ORIGINS"\s*:\s*"https:\/\/showtimetracker\.show"/);
assert.match(exportScript, /https:\/\/showtime-api\.showtime-workers\.workers\.dev/);
assert.doesNotMatch(exportScript, /TMDB_(?:API_KEY|READ_ACCESS_TOKEN)/);
```

Keep `web-worker.test.mjs` assertions for the 301 legacy-host redirect, query preservation, and canonical deep-route asset serving. Update its import to `../src/worker.ts`.

- [ ] **Step 8: Document production responsibilities and guarded deploy commands**

Write `production/README.md` with:

```text
# Production
## Live services — canonical website, API custom domain, legacy Worker hostname
## Architecture — app export -> web Worker; API Worker -> TMDB/D1/Resend
## Install — npm ci in app, production/api, and production/web
## Build and check — npm run production:build and production:check from root
## Deploy web — explicit root command, target name, prerequisites, post-deploy checks
## Deploy API — explicit root command, target name, secrets, D1 migration caution
## Safety — local/UAT server is never deployed; dry runs do not prove remote bindings
## Rollback — list versions before rollback; data and D1 are not rolled back with code
```

- [ ] **Step 9: Verify production web packaging without deployment**

```powershell
npm --prefix production/web test
npm --prefix production/web run build
rg -l --fixed-strings "https://showtime-api.showtime-workers.workers.dev" production/web/dist
rg -n "TMDB_READ_ACCESS_TOKEN|TMDB_API_KEY|Bearer eyJ|api_key=|localhost:3001" production/web/dist
npm --prefix production/web run security:scan
npm --prefix production/web run bundle
```

Expected: tests/build/scan/dry-run pass; the public API URL is present; the credential and localhost search returns no matches.

- [ ] **Step 10: Commit the production web area**

```powershell
git add production/web production/README.md mobile
git diff --cached --check
git commit -m "refactor: separate production web deployment"
```

Expected: no tracked file remains under `mobile/`.

---

### Task 7: Add root commands and enforce repository boundaries

**Files:**
- Create: `package.json`
- Create: `scripts/run-local.mjs`
- Create: `scripts/run-local.test.mjs`
- Create: `tests/repository-structure.test.mjs`
- Modify: `.gitignore`
- Remove after verified regeneration: generated remnants under legacy `mobile/` and `worker/`

**Interfaces:**
- Consumes: package scripts in `app/`, `production/api/`, and `production/web/`; local Node entry point
- Produces: stable root commands and automated structural constraints for future contributors and agents

- [ ] **Step 1: Remove only verified generated legacy remnants**

Resolve `mobile/` and `worker/` to absolute paths and verify both are inside the current worktree. List remaining entries without reading their contents. Confirm local secrets already exist only at `local-uat/.env.local` and `production/api/.dev.vars`.

Use `Remove-Item -LiteralPath` only for individually verified generated directories such as old `.wrangler`, `.wrangler-dry-run`, `dist`, and `worker-dist`. Remove the legacy roots only after they are empty. Do not use globs or recursive deletion against the repository root. Report the exact generated directories removed; each is reproducible from the new documented build command.

- [ ] **Step 2: Write the structure contract against the completed moves**

Create `tests/repository-structure.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

async function exists(relativePath) {
  try { await stat(path.join(root, relativePath)); return true; } catch { return false; }
}

async function sourceFiles(relativePath) {
  const directory = path.join(root, relativePath);
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'worker-dist', '.wrangler'].includes(entry.name)) continue;
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) output.push(...await sourceFiles(child));
    else if (/\.(?:[cm]?[jt]sx?)$/.test(entry.name)) output.push(child);
  }
  return output;
}

test('uses explicit environment roots and no legacy roots', async () => {
  for (const directory of ['app', 'shared/tmdb-api', 'production/api', 'production/web', 'local-uat/api']) {
    assert.equal(await exists(directory), true, `${directory} is required`);
  }
  assert.equal(await exists('mobile'), false, 'legacy mobile root must be removed');
  assert.equal(await exists('worker'), false, 'legacy worker root must be removed');
});

test('keeps production and local UAT source independent', async () => {
  for (const file of await sourceFiles('production')) {
    assert.doesNotMatch(await readFile(path.join(root, file), 'utf8'), /from\s+['"][^'"]*local-uat/);
  }
  for (const file of await sourceFiles('local-uat')) {
    assert.doesNotMatch(await readFile(path.join(root, file), 'utf8'), /from\s+['"][^'"]*production/);
  }
});

```

Run `node --test tests/repository-structure.test.mjs`. Expected: the directory and import-boundary tests pass.

- [ ] **Step 3: Create the root package aliases**

Create `package.json`:

```json
{
  "name": "showtime-repository",
  "private": true,
  "type": "module",
  "scripts": {
    "local": "node scripts/run-local.mjs",
    "local:web": "npm --prefix app run web",
    "local:api": "node local-uat/api/start.mjs",
    "local:tmdb": "node local-uat/api/search-tmdb.mjs",
    "local:test": "node --test shared/tmdb-api/*.test.mjs local-uat/api/*.test.mjs",
    "app:check": "npm --prefix app run check",
    "production:build": "npm --prefix production/web run build",
    "production:check": "npm run app:check && npm --prefix production/api run check && npm --prefix production/api run bundle && npm --prefix production/web run check",
    "production:deploy:web": "npm --prefix production/web run deploy",
    "production:deploy:api": "npm --prefix production/api run deploy",
    "test:structure": "node --test tests/repository-structure.test.mjs scripts/run-local.test.mjs",
    "check": "npm run test:structure && npm run local:test && npm run production:check"
  }
}
```

- [ ] **Step 4: Add a dependency-free local process runner**

Create `scripts/run-local.mjs` with an exported command selector:

```js
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function localCommands(platform = process.platform) {
  return [
    { command: process.execPath, args: ['local-uat/api/start.mjs'] },
    { command: platform === 'win32' ? 'npm.cmd' : 'npm', args: ['--prefix', 'app', 'run', 'web'] },
  ];
}

export function runLocal() {
  const children = localCommands().map(({ command, args }) => spawn(command, args, {
    cwd: repositoryRoot,
    env: process.env,
    stdio: 'inherit',
  }));
  let stopping = false;
  const stop = (code) => {
    if (stopping) return;
    stopping = true;
    for (const child of children) if (child.exitCode === null) child.kill();
    process.exitCode = code;
  };
  for (const child of children) {
    child.once('error', () => stop(1));
    child.once('exit', (code) => stop(code ?? 1));
  }
  process.once('SIGINT', () => stop(0));
  process.once('SIGTERM', () => stop(0));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) runLocal();
```

Create `scripts/run-local.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { localCommands } from './run-local.mjs';

test('starts the local API and web client with platform-safe commands', () => {
  const windows = localCommands('win32');
  assert.deepEqual(windows[0].args, ['local-uat/api/start.mjs']);
  assert.equal(windows[1].command, 'npm.cmd');
  assert.deepEqual(windows[1].args, ['--prefix', 'app', 'run', 'web']);
  assert.equal(localCommands('linux')[1].command, 'npm');
});
```

- [ ] **Step 5: Make root ignore rules cover all environment outputs and secrets**

Replace the one-line root `.gitignore` with:

```gitignore
.worktrees/
.vscode/
**/node_modules/
**/.expo/
**/.wrangler/
**/.wrangler-dry-run/
**/dist/
**/worker-dist/
**/.env.local
**/.dev.vars
**/.dev.vars.*
!**/.env.example
```

Do not remove the package-level ignore files; they document ownership close to generated content.

- [ ] **Step 6: Verify root commands and ignore behaviour**

```powershell
npm run local:test
npm run app:check
npm run test:structure
git check-ignore -v local-uat/.env.local production/api/.dev.vars production/web/dist production/api/worker-dist .vscode
```

Expected: local, app, runner, directory, and import-boundary checks pass. All listed private/generated paths are ignored.

- [ ] **Step 7: Commit the enforceable repository shell**

```powershell
git add package.json scripts tests .gitignore
git diff --cached --check
git commit -m "build: add explicit environment commands"
```

---

### Task 8: Make all current documentation and agent guidance authoritative

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `app/README.md`
- Modify: `docs/PROJECT_CONTEXT.md`
- Modify: `docs/DEPLOYMENT-AND-DISTRIBUTION.md`
- Modify: `docs/CLOUDFLARE-RUNBOOK.md`
- Modify: `docs/ROADMAP.md`
- Modify: `production/README.md`
- Modify: `local-uat/README.md`
- Create: `.github/copilot-instructions.md`

**Interfaces:**
- Consumes: the final paths and root commands from Tasks 2–7
- Produces: one consistent web-first repository contract for humans, Codex, and GitHub Copilot

- [ ] **Step 1: Add a failing documentation contract test**

Append this test to `tests/repository-structure.test.mjs`:

```js
test('documents the web-first repository contract for people and agents', async () => {
  for (const file of ['README.md', 'AGENTS.md', '.github/copilot-instructions.md', 'production/README.md', 'local-uat/README.md']) {
    const text = await readFile(path.join(root, file), 'utf8');
    assert.match(text, /web-first/i, `${file} must say web-first`);
    assert.match(text, /production/i, `${file} must describe production`);
    assert.match(text, /local[ /-]UAT/i, `${file} must describe local UAT`);
  }
});
```

Run `node --test tests/repository-structure.test.mjs`. Expected: FAIL because `.github/copilot-instructions.md` does not exist and current documentation does not yet share the required language.

- [ ] **Step 2: Rewrite the root README around environment selection**

The root README must begin with the following facts before feature history:

```text
Showtime is a web-first movie and TV tracker. The live website is
https://showtimetracker.show. The repository has two explicit environment
areas: production/ for deployable Cloudflare code and local-uat/ for local-only
development and acceptance tooling. Shared product code lives in app/ and
shared/ and must not be copied into either environment.
```

Include the final tree, the root commands, installation commands for all three packages, links to both environment READMEs, and the statement that native apps are a possible later direction rather than a current release target.

- [ ] **Step 3: Replace stale agent instructions with the repository contract**

Update `AGENTS.md` to include these mandatory rules:

```text
Before editing, classify the change as shared app, shared TMDB core,
production, or local/UAT. Deployable files belong under production/.
Local-only servers and QA tooling belong under local-uat/. Cross-environment
behaviour belongs under app/ or shared/ and is never duplicated.

production/ must not import local-uat/, and local-uat/ must not import
production/. The local Node proxy is never deployed. The website and browser
workflow are primary; preserve inexpensive native compatibility without making
native distribution part of routine releases.

Any path, command, environment, or deployment change must update README.md,
the owning environment README, affected current docs, AGENTS.md, and
.github/copilot-instructions.md in the same change.
```

Retain applicable security and verification rules, but replace every current path and remove claims that production is merely planned.

- [ ] **Step 4: Add matching GitHub Copilot instructions**

Create `.github/copilot-instructions.md`:

```markdown
# Showtime repository instructions

Showtime is web-first. The live product is the Cloudflare-hosted website;
native apps are only a possible later direction.

- `app/` is the shared Expo/React Native Web client.
- `shared/tmdb-api/` is the environment-neutral TMDB core.
- `production/` contains every deployable Cloudflare adapter and config.
- `local-uat/` contains local-only development and acceptance tooling.
- Never copy shared behaviour into both environments.
- Never import `production/` from `local-uat/`, or `local-uat/` from `production/`.
- Never deploy the local Node proxy.
- Preserve Worker names, routes, bindings, D1 identifiers, secret names, and
  the server-side credential boundary unless a reviewed design explicitly changes them.
- Use root package scripts so the target environment is visible.
- Run checks for every affected area and never claim a live deployment from a dry run.
- When paths, commands, environments, or deployment behaviour change, update
  the root README, owning environment README, current architecture/operations
  docs, this file, and `AGENTS.md` in the same commit.
- Files under `docs/superpowers/` and dated verification records are historical;
  do not rewrite them merely because current paths changed.
```

- [ ] **Step 5: Update current architecture and operations documentation**

Apply these exact responsibilities:

- `app/README.md`: browser-first setup and app internals; `npm run web` is primary, iOS/Android commands are secondary compatibility checks; no deploy commands.
- `docs/PROJECT_CONTEXT.md`: current web-first architecture, production endpoints, shared/local/production tree, deployed accounts and D1, and the known sync gap.
- `docs/DEPLOYMENT-AND-DISTRIBUTION.md`: current deployed architecture rather than a future plan; exact root build/check/deploy commands; local/UAT is not hosted.
- `docs/CLOUDFLARE-RUNBOOK.md`: commands from the repository root, separate web/API deployment gates, exact smoke origin, version listing and rollback paths, and an explicit statement that this reorganisation does not deploy.
- `docs/ROADMAP.md`: Phase 8 is web-first and deployed; replace active `mobile/` and `worker/` paths with final paths while leaving dated historical narrative intact; keep native distribution in future refinements.
- `production/README.md` and `local-uat/README.md`: reconcile their commands with root `package.json` and link back to the operational docs.

- [ ] **Step 6: Search all current documentation for contradictions**

```powershell
rg -n "mobile/|worker/|planned production|future production|not currently deployed|Cloudflare is not currently deployed" README.md AGENTS.md app/README.md production/README.md local-uat/README.md docs/PROJECT_CONTEXT.md docs/DEPLOYMENT-AND-DISTRIBUTION.md docs/CLOUDFLARE-RUNBOOK.md docs/ROADMAP.md .github/copilot-instructions.md
```

Expected: matches occur only where historical context is explicitly labelled or where a generated output name such as `worker-dist` is correct. Fix every active-path or deployment-status contradiction.

- [ ] **Step 7: Make the documentation contract test pass**

```powershell
npm run test:structure
```

Expected: directory, environment-boundary, local-runner, and documentation tests all pass.

- [ ] **Step 8: Commit current documentation and agent guidance together**

```powershell
git add README.md AGENTS.md app/README.md production/README.md local-uat/README.md docs/PROJECT_CONTEXT.md docs/DEPLOYMENT-AND-DISTRIBUTION.md docs/CLOUDFLARE-RUNBOOK.md docs/ROADMAP.md .github/copilot-instructions.md
git diff --cached --check
git commit -m "docs: enforce web-first environment boundaries"
```

---

### Task 9: Run the complete release-equivalent verification

**Files:**
- Verify absent: legacy `mobile/` and `worker/` roots
- Preserve: `.vscode/`, `D:/Dev/showtime-qa`, rollback worktree, all ignored secret values
- Modify if checks reveal stale references: only the owning script/config/current documentation file

**Interfaces:**
- Consumes: the final root commands and all package-level checks
- Produces: a clean, verified repository whose source can build both production Workers later without having changed the live deployment

- [ ] **Step 1: Prove legacy roots remain absent and private files remain ignored**

Run:

```powershell
Test-Path mobile
Test-Path worker
git check-ignore -v local-uat/.env.local production/api/.dev.vars .vscode
```

Expected: both legacy path checks return `False`; the private files and editor directory are ignored. Do not read their contents.

- [ ] **Step 2: Run repository and local checks**

```powershell
npm run test:structure
npm run local:test
npm run app:check
```

Expected: all commands exit 0.

- [ ] **Step 3: Run production API checks and dry-run bundle**

```powershell
npm --prefix production/api run check
npm --prefix production/api run bundle
npm --prefix production/api audit --audit-level=high
```

Expected: shared handler tests, generated types, TypeScript, Vitest, dry-run packaging, and audit pass.

- [ ] **Step 4: Run production web checks and inspect the generated bundle**

```powershell
npm --prefix production/web run check
rg -l --fixed-strings "https://showtime-api.showtime-workers.workers.dev" production/web/dist
rg -n "TMDB_READ_ACCESS_TOKEN|TMDB_API_KEY|Bearer eyJ|api_key=|localhost:3001" production/web/dist
```

Expected: the check passes; at least one generated JavaScript file contains the public API URL; the secret/localhost search returns no matches.

- [ ] **Step 5: Run the secondary native compatibility export**

```powershell
npm --prefix app exec expo export -- --platform ios --output-dir dist-ios-structure-check --max-workers 1
```

Expected: export exits 0. This is a compatibility signal, not a native release artifact. Remove the generated directory after confirming it is inside `app/` and ignored.

- [ ] **Step 6: Search for stale active paths and forbidden imports**

```powershell
rg -n "mobile/|worker/src/api|\.\./worker|\.\./mobile" --glob '!docs/superpowers/**' --glob '!docs/verification/**' --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/worker-dist/**' .
rg -n "from\s+['\"][^'\"]*local-uat" production
rg -n "from\s+['\"][^'\"]*production" local-uat
git ls-files | rg "(^|/)(dist|worker-dist|node_modules|\.wrangler|\.env\.local|\.dev\.vars)(/|$)"
```

Expected: no active stale path, forbidden import, generated output, or secret file is tracked. Historical documents may retain explicitly historical paths.

- [ ] **Step 7: Verify live services without deploying**

Run read-only HTTP checks:

```powershell
curl.exe -sS -D - -o NUL https://showtimetracker.show/
curl.exe -sS -D - -o NUL https://showtimetracker.show/profile
curl.exe -sS -D - -o NUL https://api.showtimetracker.show/
curl.exe -sS -D - -o NUL -H "Sec-Fetch-Mode: navigate" https://showtime-web.showtime-workers.workers.dev/search?q=batman
```

Expected: canonical root and deep route return 200; API root returns its production-safe 404 JSON response; the legacy browser navigation returns 301 to the same path and query on `showtimetracker.show`.

Do not run either deploy command.

- [ ] **Step 8: Review the final diff and commit verification fixes**

```powershell
git status --short
git diff --check
git diff --stat HEAD~8..HEAD
git log -10 --oneline --decorate
```

If cleanup or verification required tracked fixes, stage only those exact files and commit:

```powershell
git commit -m "chore: complete repository environment migration"
```

Expected final status: clean. The preserved `.vscode/`, build output, and secrets are ignored and do not appear in normal status, and the live deployment has not changed.
