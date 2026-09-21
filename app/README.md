# Showtime shared app

`app/` is the shared Expo SDK 57, React Native and TypeScript client. Showtime is web-first: `npm run web` and the browser experience are the primary development path. iOS and Android remain low-cost compatibility targets, not routine production releases.

The client provides Home, Search, Watchlist and Profile navigation; movie, TV and person details; local movie/episode progress; viewing history; upcoming episodes; discovery; and optional account access.

## Install and run

From the repository root:

```sh
npm --prefix app ci
npm run local
```

`npm run local` starts both the local Node API and the browser client. To run only the browser:

```sh
npm run local:web
```

Optional native compatibility checks can be started from `app/` with `npm run ios` or `npm run android`. Expo Go must be able to reach the computer on the private network. These commands do not deploy or publish a native app.

## Source structure

- `src/app/` contains Expo Router screens and route layouts.
- `src/components/` contains shared UI plus `.web.tsx` browser variants where required.
- `src/services/` contains client API calls, storage, progress, sync and domain rules.
- `src/hooks/` and `src/constants/` contain shared hooks and design tokens.
- `assets/` contains application and TMDB attribution assets.
- `tests/` contains client-side domain and persistence tests.

The client may call a local or production API, but it never contains the TMDB credential. Environment-neutral server behaviour belongs in `shared/tmdb-api/`; local and Cloudflare adapters belong in their explicit environment areas.

## Local API selection

For local/UAT setup, copy `local-uat/.env.example` to `local-uat/.env.local` and set `TMDB_READ_ACCESS_TOKEN`. The token stays in the Node process. `EXPO_PUBLIC_SEARCH_API_URL`, when needed, may contain only the public URL of that local server.

Production exports are created by `production/web/scripts/export-web.mjs`, which supplies `https://api.showtimetracker.show` at build time. There are no deployment commands in this package.

## Verify

From the repository root:

```sh
npm run app:check
```

That runs lint, TypeScript and 92 client tests. Run the separate online recommendation check with `npm --prefix app run dependencies:check` only when reviewing an intentional Expo dependency update; network metadata can recommend newer patch releases than the pinned lockfile.

For changes affecting export or production endpoint selection, also run `npm run production:build` and the generated-bundle checks in `npm run production:check`.

## Local data and sync

Guest mode stores Watchlist, recent searches, Recently Viewed, settings, movie status, TV progress, schedules and viewing activity locally. Optional email/password accounts use the production API and D1-backed sync.

A known sync gap remains: logging into an existing populated account does not always hydrate and merge remote collections into the local UI. Fixes must preserve both guest and remote data, avoid duplicates and refresh visible state after merge.

## Feature rules worth preserving

- Movie and TV records with the same TMDB ID are distinct.
- TV progress is independent of Watchlist membership.
- Specials remain visible but untracked.
- Future and undated episodes cannot be marked watched.
- Air dates use the device's local calendar and UK `DD/MM/YYYY` display.
- TMDB attribution remains visible and upstream payloads are reduced to the public app contract.

## Documentation

- [Repository overview](../README.md)
- [Local / UAT](../local-uat/README.md)
- [Production](../production/README.md)
- [Project context](../docs/PROJECT_CONTEXT.md)
- [Roadmap](../docs/ROADMAP.md)
