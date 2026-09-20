# Production and Local/UAT Repository Structure Design

## Intent

Reorganise Showtime as a web-first application so that production deployment
code and local/UAT tooling are unmistakably separated while the application
and environment-neutral API logic remain single sources of truth. A developer,
Codex, or GitHub Copilot should be able to identify the correct environment,
command, and configuration without reconstructing deployment history.

The public website is the primary product and the browser is the primary local
and UAT target. Existing Expo and React Native compatibility should remain
available where it costs little to preserve, leaving open a small possibility
of native apps later, but native distribution is not a current repository or
release priority.

The production website must continue to use the existing Cloudflare resources
and public endpoints throughout the source-only migration. No deployment is
part of the file move itself.

## Current State

The current production source is the `feature/cloudflare-api` worktree. The
older `rollback-stable-baseline` checkout does not contain the deployed Worker
implementation and is not the source for this reorganisation.

The repository currently mixes responsibilities:

- `mobile/src`, assets, and Expo configuration are shared by local, native, and
  production-web builds.
- `mobile/server` is the local-only Node proxy on port 3001.
- `mobile/wrangler.jsonc`, `mobile/src/web-worker.ts`, and production export,
  smoke, and secret-scanning scripts are production deployment tooling.
- `worker` is the production Cloudflare API Worker, but `worker/src/api`
  contains environment-neutral TMDB logic already reused by the local proxy.
- `D:/Dev/showtime-qa` is outside Git and contains dated, ad-hoc QA scripts,
  generated screenshots, logs, and dependencies. It is not part of this
  migration.

The deployed services are:

- `showtime-web`, serving `https://showtimetracker.show`
- `showtime-api`, serving `https://api.showtimetracker.show` and its existing
  `workers.dev` endpoint

## Goals

1. Make `production/` and `local-uat/` obvious root-level environment areas.
2. Make the production website and local browser workflow the documented
   primary paths.
3. Keep the Expo application and reusable TMDB logic shared rather than copied.
4. Preserve production Worker names, routes, bindings, secrets, D1 database,
   compatibility behaviour, asset routing, and public URLs.
5. Give each environment documented build, test, and run/deploy commands.
6. Make the structure an explicit rule for human contributors, Codex, and
   GitHub Copilot.
7. Remove only generated or demonstrably superseded files; preserve uncertain
   artifacts and all unrelated user work.

## Non-goals

- Creating a remotely hosted UAT or staging environment.
- Deploying either production Worker during the reorganisation.
- Changing application behaviour, visual design, authentication, sync, API
  responses, storage schemas, or public URLs.
- Removing existing native compatibility solely to enforce web-first wording.
- Preparing App Store, Play Store, TestFlight, EAS, or other native
  distribution.
- Upgrading Expo, Wrangler, Cloudflare libraries, or other dependencies.
- Importing or deleting the external `D:/Dev/showtime-qa` directory.
- Rewriting historical specifications and plans to use new paths. Historical
  documents remain records of the repository at the time they were written.

## Considered Approaches

### 1. Environment folders plus shared sources — selected

Place deployment adapters and configuration in `production/`, local tooling in
`local-uat/`, the universal Expo client in `app/`, and environment-neutral API
logic in `shared/`.

This makes ownership clear without duplicating application or API behaviour.
The trade-off is a coordinated path migration across scripts, tests, imports,
and documentation.

### 2. Minimal environment-only move

Move only `worker/` and `mobile/server/`, leaving production web tooling mixed
into `mobile/` and allowing local code to import from the production Worker.

This creates less immediate churn but preserves the confusing boundaries that
prompted the reorganisation.

### 3. Complete production and UAT copies

Copy the application and backend into two self-contained trees.

This makes each environment superficially independent but creates duplicated
source, tests, dependencies, and fixes. The copies would drift and are rejected.

## Target Structure

```text
showtime/
|-- app/                         # Shared web-first Expo client
|   |-- assets/
|   |-- src/
|   |-- tests/                   # Environment-neutral app tests
|   |-- app.json
|   |-- package.json
|   `-- README.md
|-- shared/
|   `-- tmdb-api/                # Shared TMDB parsing, handlers and tests
|-- production/
|   |-- api/                     # Cloudflare API Worker
|   |   |-- migrations/
|   |   |-- src/
|   |   |-- test/
|   |   |-- wrangler.jsonc
|   |   `-- package.json
|   |-- web/                     # Cloudflare Static Assets Worker
|   |   |-- scripts/
|   |   |-- src/
|   |   |-- test/
|   |   `-- wrangler.jsonc
|   `-- README.md
|-- local-uat/
|   |-- api/                     # Local Node proxy and tests
|   |-- qa/                      # Maintained local browser checks only
|   |-- .env.example
|   `-- README.md
|-- docs/
|-- .github/
|   `-- copilot-instructions.md
|-- AGENTS.md
|-- package.json                 # Discoverable command aliases
`-- README.md
```

`local-uat/qa` may initially contain only documentation or a placeholder. The
old external QA scripts must not be copied blindly because they use hard-coded
paths and target an older UI. Only tests reviewed and updated for the current
application may enter the repository.

## Ownership Boundaries

### Shared application

`app/` owns the web-first Expo Router client: screens, components, hooks, local
persistence, client services, assets, Expo configuration, and application
tests. It must not own Cloudflare deployment configuration or the local Node
server.

Browser behaviour, responsive layouts, browser persistence, direct URL loads,
and production web exports are the primary acceptance targets. Existing iOS
and Android compatibility remains secondary and should not drive production
folder structure or release commands. A future decision to ship native apps
may build on the retained cross-platform code but requires its own design and
distribution plan.

The client chooses its API origin through the existing public environment
variable and development fallback logic. Production builds set the production
API URL explicitly; local development defaults to the local proxy.

### Shared TMDB API core

`shared/tmdb-api/` owns request parsing, TMDB transport, search, discovery, and
details handlers that do not depend on Node server objects or Cloudflare Worker
bindings. Both environment adapters import this code.

This extraction formalises the reuse that already exists between
`mobile/server` and `worker/src/api`. Cloudflare-only authentication and sync
logic remain under `production/api`.

### Production

`production/web/` owns the production Expo export wrapper, Static Assets Worker
entry point, web Wrangler configuration, production security scan, remote smoke
checks, and deployment-contract tests.

`production/api/` owns the Cloudflare request adapter, CORS, cache, rate limits,
logging, email, authentication, sync, D1 access and migrations, Worker tests,
generated binding types, Wrangler configuration, and deployment commands.

The following production identities and values must not change during the move:

- Worker names `showtime-web` and `showtime-api`
- API custom domain route `api.showtimetracker.show`
- frontend origin `https://showtimetracker.show`
- D1 binding `SHOWTIME_DB`, database name, and database ID
- all rate-limit binding names and namespace IDs
- secret names `TMDB_READ_ACCESS_TOKEN` and `RESEND_API_KEY`
- web asset fallback and legacy-host redirect behaviour
- the production API URL embedded by the web export

Wrangler paths must be resolved relative to their new configuration files.
Generated web output remains ignored and is produced under
`production/web/dist/` immediately before release checks or deployment.

### Local/UAT

`local-uat/api/` owns the Node HTTP adapter, permissive local CORS, memory cache,
LAN address reporting, and local integration tests. It imports only from
`shared/tmdb-api/`, never from `production/`.

`local-uat/.env.local` holds the local TMDB token and remains ignored. The
tracked `.env.example` documents the token and optional public local-server URL
without containing values.

“UAT” means local pre-production acceptance testing in this design. Adding a
remote Cloudflare UAT environment would require a separate design covering
Worker environments, domains, secrets, and isolated D1 data.

## Commands and Dependency Layout

Root `package.json` provides memorable aliases and delegates to the owning
package. It does not hide the target environment.

The intended command families are:

```text
npm run local
npm run local:web
npm run local:api
npm run local:test
npm run production:build
npm run production:check
npm run production:deploy:web
npm run production:deploy:api
```

Deployment commands must remain separate so an operator cannot accidentally
deploy both services while intending to update only one. Documentation must
state the working directory, prerequisites, environment variables, and target
for every deploy command.

Existing pinned versions and lockfiles are preserved wherever practical. A
dependency is moved only when its owning package moves; versions are not
upgraded as part of this work.

## Documentation and Agent Instructions

The following current documents must be updated to describe the same structure
and commands:

- root `README.md`
- root `AGENTS.md`
- `app/README.md`
- `production/README.md`
- `local-uat/README.md`
- `docs/PROJECT_CONTEXT.md`
- `docs/DEPLOYMENT-AND-DISTRIBUTION.md`
- `docs/CLOUDFLARE-RUNBOOK.md`
- `docs/ROADMAP.md` where current paths or environment status appear

Add `.github/copilot-instructions.md` with concise mandatory rules:

- identify whether a change is shared, production, or local/UAT before editing;
- treat the website and browser workflow as the primary product path while
  preserving inexpensive cross-platform compatibility;
- keep deployable code under `production/` and local-only code under
  `local-uat/`;
- place cross-environment code under `app/` or `shared/` rather than copying it;
- never import `production/` from `local-uat/` or the reverse;
- never deploy the local Node proxy;
- preserve production names, routes, bindings, and secret boundaries;
- run the documented checks for every affected area;
- update current documentation whenever paths or commands change.

`AGENTS.md` carries the same repository contract for Codex and other agents,
plus pointers to environment-specific READMEs. Historical files under
`docs/superpowers/` and dated verification records are not mass-edited; the
current documentation explicitly labels them historical when necessary.

## Migration Strategy

1. Establish passing baseline checks on the current `feature/cloudflare-api`
   worktree and record any pre-existing failure.
2. Add root command aliases and target directories without changing runtime
   behaviour.
3. Move the Expo app from `mobile/` to `app/`.
4. Extract the shared TMDB modules and tests from `worker/src/api` into
   `shared/tmdb-api/`, then update production and local imports.
5. Move the local Node proxy and its tests into `local-uat/api/`.
6. Move the Cloudflare API Worker into `production/api/`, preserving all
   configuration values and the current uncommitted email-template changes.
7. Move web deployment configuration, entry point, scripts, and tests into
   `production/web/`; make the export output and Wrangler asset directory agree.
8. Update root, environment, operational, project-context, and agent/Copilot
   documentation.
9. Remove only superseded tracked files and clearly generated untracked output.
10. Run complete local, shared-app, production API, production web, type, lint,
    build, secret-scan, and Wrangler dry-run checks.
11. Verify the public frontend and API remain healthy without deploying the
    reorganised source.

File moves should retain Git history where possible. Each step must keep tests
or configuration checks capable of detecting stale paths.

## Cleanup Policy

Safe cleanup includes generated `dist`, `worker-dist`, `.wrangler`, and
`.wrangler-dry-run` output once their replacements can be regenerated and the
paths are ignored. Obsolete tracked files are removed only after all references
are updated and repository-wide search finds no consumers.

Do not remove or overwrite:

- the uncommitted email-template changes;
- untracked editor configuration;
- the older rollback checkout;
- external `showtime-qa` files;
- local secret files; or
- historical design, plan, screenshot, and verification records.

## Verification

The final verification must include:

- repository-wide stale-path and forbidden cross-environment import searches;
- shared TMDB API tests;
- local Node proxy tests;
- Expo application tests, lint, TypeScript, dependency validation, and web/iOS
  exports as supported by the existing project checks, with the web export as
  the required release artifact and the iOS export retained as a secondary
  compatibility check;
- production API tests, generated Worker types, TypeScript, Vitest, dependency
  audit, and Wrangler dry-run bundle;
- production web deployment-contract tests, web export, secret scan, and
  Wrangler dry-run bundle;
- HTTP checks for the canonical frontend, API custom domain, and legacy web
  hostname behaviour.

A dry run validates packaging but does not mutate Cloudflare. No real deploy is
required to prove this source-only reorganisation.

## Rollback

The live site is unaffected until a future explicit deployment. If the source
migration fails verification, revert only the reorganisation commits or return
to the pre-migration branch commit. Cloudflare rollback is unnecessary because
this work does not deploy.

## Acceptance Criteria

- The repository visibly exposes `production/` and `local-uat/` at its root.
- Current documentation consistently describes Showtime as web-first and
  native apps as a possible later direction rather than a current release path.
- Shared application and TMDB behaviour exist in one place each.
- Local/UAT code has no imports from production code and production code has no
  imports from local/UAT code.
- Existing production resource identities and runtime configuration are
  unchanged.
- Current documentation, `AGENTS.md`, and Copilot instructions agree on the
  structure, boundaries, commands, and verification requirements.
- Generated output and secrets remain untracked.
- All relevant checks pass, with any environment-limited check reported rather
  than assumed.
- The live site and API remain healthy after the source migration.
