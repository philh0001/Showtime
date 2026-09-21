# Showtime

Showtime is a web-first movie and TV tracker. The live website is [showtimetracker.show](https://showtimetracker.show). The repository has two explicit environment areas: `production/` for deployable Cloudflare code and `local-uat/` for local-only development and acceptance tooling. Shared product code lives in `app/` and `shared/` and must not be copied into either environment.

The product supports search, discovery, Watchlist, movie and TV progress, viewing history, upcoming episodes, optional accounts, and cloud sync. Native apps are a possible later direction, not a current release target.

## Repository map

```text
app/                  Shared Expo/React Native Web client; browser workflow first
shared/tmdb-api/      Environment-neutral TMDB request and response logic
production/
  api/                Deployable Cloudflare API Worker, D1 migrations and tests
  web/                Deployable Static Assets Worker and production web build
local-uat/
  api/                Local-only Node TMDB adapter
  qa/                 Maintained browser acceptance notes
docs/                 Current architecture, operations and roadmap documentation
scripts/              Repository-level development helpers
tests/                Repository structure and environment-boundary checks
```

`production/` and `local-uat/` are adapters around shared code. They must never import each other.

## Install

Use Node.js 22, then install each package from the repository root:

```sh
npm --prefix app ci
npm --prefix production/api ci
npm --prefix production/web ci
```

Create `local-uat/.env.local` from `local-uat/.env.example` and add the server-side TMDB read token. Never use an `EXPO_PUBLIC_*` variable for a credential.

## Work locally

```sh
npm run local
```

This starts the local Node API and browser client together. Use `npm run local:api` and `npm run local:web` in separate terminals when debugging either process. `npm run local:tmdb -- "Batman"` checks TMDB directly from the server side.

Optional native compatibility commands remain under `app/` (`npm run ios` and `npm run android`), but browser behaviour is the routine development and release path.

## Verify

```sh
npm run app:check
npm run local:test
npm run test:structure
npm run production:check
```

`npm run check` runs the complete non-deploying repository gate. A successful build or Wrangler dry run does not mean production was deployed.

## Production

Production is owned by [`production/`](production/README.md). The live API is
`https://api.showtimetracker.show`. The old web Worker hostname permanently
redirects to `https://showtimetracker.show`, preserving paths and queries.
Deployment commands are explicit:

```sh
npm run production:deploy:web
npm run production:deploy:api
```

Run them only as a reviewed release operation after the production gate passes. See the [Cloudflare runbook](docs/CLOUDFLARE-RUNBOOK.md).

## Local / UAT

Local development and acceptance testing are owned by [`local-uat/`](local-uat/README.md). The Node proxy is permissive local tooling and is never deployed. There is currently no hosted UAT service, UAT domain, UAT D1 database, or remote UAT secret set.

## Documentation

- [Application internals](app/README.md)
- [Project context](docs/PROJECT_CONTEXT.md)
- [Library sync design](docs/SYNC-DESIGN.md)
- [Deployment and distribution](docs/DEPLOYMENT-AND-DISTRIBUTION.md)
- [Cloudflare operations runbook](docs/CLOUDFLARE-RUNBOOK.md)
- [Roadmap](docs/ROADMAP.md)

When a path, command, environment boundary, or deployment process changes, update the root README, the owning environment README, current architecture/operations docs, `AGENTS.md`, and `.github/copilot-instructions.md` in the same change.
