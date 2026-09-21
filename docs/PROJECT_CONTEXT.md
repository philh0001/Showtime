# Showtime project context

## Product

Showtime is a web-first movie and TV tracker. The live website is `https://showtimetracker.show`; native clients are a possible later refinement rather than a current release target.

The application supports Home discovery, search, movie/TV/person details, Watchlist, movie watched status, TV season and episode progress, Recently Viewed, viewing history, upcoming episodes, profile statistics, settings and optional accounts.

## Current repository architecture

```text
app/                  Shared Expo/React Native Web client
shared/tmdb-api/      Environment-neutral TMDB parsing and handlers
production/api/       Cloudflare API Worker, D1 migration and Worker tests
production/web/       Static Assets Worker, web build and release checks
local-uat/api/        Local-only Node adapter for development
local-uat/qa/         Maintained browser acceptance notes
```

There are two explicit environment areas. `production/` contains deployable Cloudflare adapters and configuration. `local-uat/` contains non-deployable development and acceptance tooling. They import shared code but never each other.

The browser workflow is primary. The shared Expo client retains iOS and Android compatibility where inexpensive, but native distribution is not part of routine releases.

## Production architecture

```text
Browser
  -> showtimetracker.show (showtime-web Static Assets Worker)
  -> api.showtimetracker.show (showtime-api Worker)
       -> shared/tmdb-api
       -> TMDB using a server-side Worker secret
       -> Cloudflare D1 for accounts and synced collections
       -> Resend for account verification/reset email
```

The web Worker permanently redirects the old Workers hostname to the canonical
website, preserving paths and queries. The API CORS allowlist is pinned to
`https://showtimetracker.show`. The deployed identities, custom domain, D1
database ID and rate-limit bindings are characterized by tests in
`production/api/test/config.spec.ts`.

## Local / UAT architecture

`npm run local` starts the Node adapter in `local-uat/api/` and the browser client in `app/`. The ignored `local-uat/.env.local` contains the TMDB read token and is loaded only by server-side Node processes. There is no hosted UAT service or separate UAT database.

The local adapter deliberately mirrors the public TMDB response contract through `shared/tmdb-api/`, but it is permissive development tooling and must never be deployed.

## Data and accounts

Guest mode stores Watchlist, recent searches, Recently Viewed, viewing activity, settings, movie progress, TV progress and schedule snapshots locally. These values are convenience data, not credential storage or a guaranteed backup.

Optional email/password accounts are implemented by the production API. Passwords are processed through the account endpoints, account/sync data is stored in D1, and account email is sent through Resend when configured.

### Sync work awaiting release

The feature worktree contains a first-login merge, account-scoped sync metadata, conditional D1 revision writes, stale-write retries, local-edit triggers, visible refresh and tests for two-device recovery. It is local code only: no D1 migration, API Worker or website deployment has been applied to production. See [Library sync design](SYNC-DESIGN.md) for the merge contract, release order and remaining limits.

## Important product rules

- Movie and TV items with the same TMDB ID remain separate.
- Search and details expose only the validated public response contract.
- TV progress is independent from Watchlist membership.
- Specials are visible but untracked; future or undated episodes cannot be marked watched.
- Dates use the device-local calendar and UK display format.
- Failed or malformed storage reads remain distinguishable from a legitimate empty collection.
- Writes are serialized where concurrent updates could otherwise lose data.

## Verification baseline

Use root scripts:

```sh
npm run app:check
npm run local:test
npm run test:structure
npm run production:check
```

`npm run check` combines the complete non-deploying gate. Production checks generate a browser bundle, confirm it selects `https://api.showtimetracker.show`, reject local endpoints and credential patterns, test both Workers, run dependency audits and create Wrangler dry-run bundles.

## Documentation ownership

- Setup and repository selection: `README.md`
- Shared app internals: `app/README.md`
- Production responsibilities: `production/README.md`
- Local development: `local-uat/README.md`
- Deployment procedure: `docs/CLOUDFLARE-RUNBOOK.md`
- Product direction: `docs/ROADMAP.md`

Path, command, environment and deployment changes must update the current documentation and both agent instruction files in the same change. Dated verification records and `docs/superpowers/` are historical evidence, not current operating instructions.
