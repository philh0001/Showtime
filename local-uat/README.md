# Local / UAT

`local-uat/` owns browser-first local development and acceptance tooling before a change reaches production. It is local-only: there is no hosted UAT domain, UAT D1 database or remote UAT secret set.

## Setup

Copy `local-uat/.env.example` to `local-uat/.env.local` and set only the server-side `TMDB_READ_ACCESS_TOKEN`. The ignored file must never be committed, logged, screenshotted or exposed through an `EXPO_PUBLIC_*` variable.

Install the shared client dependencies:

```sh
npm --prefix app ci
```

## Run

From the repository root:

```sh
npm run local
```

This starts the local Node API on port 3001 and the Expo browser client. For separate terminals use:

```sh
npm run local:api
npm run local:web
```

Use `npm run local:tmdb -- "Batman"` for a direct server-side TMDB diagnostic.

## Test

```sh
npm run local:test
npm run app:check
npm run test:structure
```

## Boundaries

The local Node adapter imports `shared/tmdb-api/` and provides permissive development CORS. Never deploy or expose it publicly. It must not import `production/`, and production must not import it.

Only maintained browser acceptance notes belong in `local-uat/qa/`. The historical external `D:/Dev/showtime-qa` directory is intentionally not part of this repository.

See the [repository overview](../README.md) and [project context](../docs/PROJECT_CONTEXT.md).
