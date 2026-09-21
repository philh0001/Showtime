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

For local/UAT setup, copy `local-uat/.env.example` to `local-uat/.env.local` and set `TMDB_READ_ACCESS_TOKEN`. The token stays in the Node process. If local API address discovery needs an override, create ignored `app/.env.local` with `EXPO_PUBLIC_SEARCH_API_URL=http://YOUR_COMPUTER_IP:3001` and restart Expo. That public variable must contain only the local server URL, never a credential.

Production exports are created by `production/web/scripts/export-web.mjs`, which supplies `https://api.showtimetracker.show` at build time. There are no deployment commands in this package.

## Verify

From the repository root:

```sh
npm run app:check
```

That runs lint, TypeScript and the client tests. Run the separate online recommendation check with `npm --prefix app run dependencies:check` only when reviewing an intentional Expo dependency update; network metadata can recommend newer patch releases than the pinned lockfile.

For changes affecting export or production endpoint selection, also run `npm run production:build` and the generated-bundle checks in `npm run production:check`.

## Local data and sync

Guest mode stores Watchlist, recent searches, Recently Viewed, settings, movie status, TV progress, schedules and viewing activity locally. Optional email/password accounts use the production API and D1-backed sync.

The released sync implementation merges guest and account collections on first login, then uses an account-scoped last-synced snapshot and conditional D1 revisions for later merges. Successful local writes schedule sync, and pulled changes refresh visible library screens. Failed sync leaves local data available. Signing out keeps the local library. See [Library sync design](../docs/SYNC-DESIGN.md) for conflict rules and limitations.

The website offers an optional iPhone Home Screen experience. Safari and the Home Screen app have separate local storage. To transfer a guest library, create and verify an account in Safari, wait for sync, then sign in from the Home Screen icon. The profile page keeps the installation steps available after the Home tip is dismissed.

Home checks the saved TV shows for upcoming episodes in the background when a local schedule is missing or older than a day. It checks at most eight shows per visit, preserves saved results if a request fails, and offers a retry. The signed-in Account page shows email verification, cloud sync state, and library counts from the current device.

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
