# Showtime Project Context

## Overview

Showtime is a mobile app for discovering movies and TV shows, viewing title
details, maintaining a personal Watchlist, tracking TV viewing progress, and
returning to recently viewed titles from Home.
It is being built incrementally as a working application and as a portfolio
project for learning React Native, TypeScript, APIs, persistence, architecture,
Git, and technical documentation.

The Expo application is in `mobile/`. Development currently takes place on
`setup/foundation`; feature work should not be made directly on `main`.

## Phase status

| Phase | Status |
| --- | --- |
| Phase 1 — Foundation | Complete |
| Phase 2 — Movie & TV Search | Complete |
| Phase 3 — Content Details | Complete |
| Phase 4 — Watchlist | Complete |
| Phase 5 — TV Tracking and Air-Date Countdown | Complete |
| Phase 6 — Home, Viewing History and Discovery | Active |

Phase 5 has an approved design and a verified local implementation. Phase 6 is
the current milestone. Future phases and feature checklists belong in
`docs/ROADMAP.md`. The planned production and public-distribution direction is
documented separately in `docs/DEPLOYMENT-AND-DISTRIBUTION.md`.

## Current technology

- React Native and TypeScript
- Expo SDK 57 and Expo Router
- Expo Go for physical iPhone testing
- A computer-only Node server for TMDB requests
- AsyncStorage for device-local persistence
- Git and GitHub

## Current architecture

`iPhone / Expo Go → mobile app → local Node server on port 3001 → TMDB`

The mobile app calls the local Node server for Search, movie details, TV details,
fresh next-episode data, and cached weekly trending lists. The Node server calls TMDB and returns restricted
display fields to the app. The mobile source must never import computer-only code
from `mobile/server/`.

The TMDB API Read Access Token is stored only in the ignored
`mobile/.env.local` file. It is read by computer-side Node processes, is never
placed in an `EXPO_PUBLIC_` variable, and must never be hard-coded, logged,
committed, or bundled into the mobile app.

## Production architecture

The deployed browser architecture is:

`Showtime Web/PWA (and a future native client only if required) -> Cloudflare Worker API -> TMDB`

The frontend is deployed at `https://showtime-web.showtime-workers.workers.dev`
with Workers Static Assets. It calls the API at
`https://showtime-api.showtime-workers.workers.dev`, whose exact CORS allowlist
contains only the frontend origin. The TMDB credential remains a server-side
Worker secret. The release remains account-free and uses local browser/device
storage for personal state. See `docs/DEPLOYMENT-AND-DISTRIBUTION.md` for the
deployment and remaining verification work.

## Current application

The app uses a dark theme and preserves four main tabs: Home, Search, Watchlist,
and Profile. Movie and TV detail routes open above the tab navigator, and Back
returns to the previous tab state.

### Home

Home has Showtime branding, a Search shortcut, Continue Watching, Recently Viewed,
Watched Movies, Watchlist, Upcoming Episodes, and Trending Movies/TV. Personal
collections refresh from local storage on focus, with independent error handling.
Continue Watching includes partial episode progress and uses persistent TV title
snapshots when titles leave Recently Viewed. Upcoming uses schedules cached when
TV details open, skips past/watched episodes and shows the last-checked date.

Only Trending makes a Home network request: one `/discovery` call for both lists,
with 30-minute server and in-memory client caches and shared concurrent requests.
Failed refreshes retain previously loaded lists. Profile can disable Trending.
No per-show Home requests or background polling run. Personalised discovery is
future work. A chronological activity log now opens from Home and Profile.

### Search

Search sends title queries through the local Node server and displays first-page
TMDB movie and TV matches. Each result contains a poster fallback, title, release
year, and media type. The screen includes loading, error, and no-results states,
plus TMDB attribution.

The five newest successful title searches are remembered locally. Suggestions
are deduplicated case-insensitively, filter as the user types, can be selected to
run another search, and can be cleared.

### Movie and TV details

Selecting a Search or Watchlist item opens its dynamic movie or TV route. Details
include available poster/backdrop artwork, overview, rating, genres, release or
first-air date, and Watchlist controls. TV details also show seasons and episode
counts. Loading, retry, invalid-route, missing-data, and artwork fallback states
are implemented.

Details also include official YouTube trailer links, cast portraits and key crew.
These optional fields are appended to the main TMDB detail request. TV cast is
labelled as latest-season cast. Missing or malformed extras do not block details.

A successfully displayed movie or TV detail is recorded in Recently Viewed.
That non-blocking local write is independent from Watchlist membership and
watched progress; a storage failure never prevents the detail screen loading.

During Phase 5, the server also fetches episode details for the newest relevant
regular season. Mobile prefers TMDB's shape-validated `next_episode_to_air`
candidate and falls back to the earliest upcoming episode in that fresh season
list. It compares ISO dates with the device-local calendar date, discards past
dates, formats valid dates as UK `DD/MM/YYYY`, and shows `Airs today`, `Airs
tomorrow`, or `Airs in N days`. TMDB supplies no exact broadcast time, so
Showtime does not present an hours-and-minutes countdown or claim a UK broadcast
schedule.

### Watchlist

Movie and TV details can add or remove a title from the device-local Watchlist.
The Watchlist renders stored posters, titles, years, and media types without a
TMDB request, reopens saved details, supports removal, and includes loading,
empty, and storage-error states. Saved items persist between app sessions.

The current layout displays one saved title per row. A denser multi-column layout
is a later visual refinement recorded in the roadmap.

### Profile

Profile displays Watchlist size, watched movie and season totals, shows with
viewing progress, and individually tracked watched episode totals. It distinguishes
unreadable data from zero. It includes a persistent Trending switch, app version,
device-local data notice and TMDB credits. Authentication and accounts remain future work.

## Local persistence

AsyncStorage currently holds:

- the five most recent successful Search queries
- the device-local movie and TV Watchlist
- Phase 5 TV progress under the versioned key `showtime.tv-progress.v2`
- the 20 most recently opened titles under `showtime.recently-viewed.v1`
- current watched movies and timestamps under `showtime.movie-progress.v1`
- TV title/schedule snapshots under `showtime.tv-schedule.v1`
- the Trending preference under `showtime.settings.v1`
- newly recorded viewing actions under `showtime.viewing-activity.v1`

Recently Viewed stores the title, poster, year, media type, and view timestamp.
Reopening a title replaces its display snapshot and moves it to the front. Movie
and TV records with the same TMDB ID remain separate.

TV progress stores current trackable regular seasons, watched seasons, and
per-season episode progress as sorted, unique arrays. Valid v1 season progress
is migrated into v2 without losing whole-season choices. Watchlist reads that
local collection once to display season and newest-season episode totals without
per-title network requests. Progress is independent from Watchlist membership,
so removing and re-adding a TV show preserves it. Specials remain visible on
details but are not tracked.

These values are local convenience data, not secure credential storage. No user
account, database, cloud sync, or multi-device persistence exists.

Viewing history preserves new movie, season and episode actions, reversals and
rewatches independently of current watched status. It starts with this feature;
earlier activity timestamps are not invented. Failed watched writes do not create
events. A failed history write after a successful watched update reports the
history failure without rolling back the primary change.

## Completed Phase 5 milestone

The original TV Tracking and Air-Date Countdown design is in
`docs/superpowers/specs/2026-09-12-tv-tracking-design.md`. Its approved
newest-season episode-tracking extension is in
`docs/superpowers/specs/2026-09-13-latest-season-episode-tracking-design.md`.

The completed milestone covers whole-season controls for older seasons, individual
episode controls for the newest relevant regular season, device-local progress,
progress totals on TV details and Watchlist, Specials exclusion, v1-to-v2
migration, and TMDB date-only next-episode copy. Future episodes stay visible but
disabled. Newest-season completion is derived from its episode progress, while a
bulk action can mark or clear all episodes that have aired.

The implementation passed automated checks, an iOS export, and physical iPhone
verification through Expo Go.

## Current Phase 6 milestone

The first Phase 6 increment replaces the placeholder Home screen and establishes
versioned Recently Viewed storage. Its approved design is in
`docs/superpowers/specs/2026-09-13-home-recently-viewed-design.md`.

The implementation records successful detail views, loads Home collections from
AsyncStorage only, and displays Recently Viewed and Watchlist poster rails. It
provides the local title metadata that Continue Watching can later join to TV
progress without changing either storage schema. The dashboard, poster rails,
navigation, focus refresh, and persistence were verified on a physical iPhone
through Expo Go.

## Current limitations

- TMDB-powered Search, Details, and next-episode refresh require the development
  PC and local server on port 3001. They will not work independently on the phone
  until a secured hosted proxy is deployed.
- The local server is for private development only. It has no production access
  controls or request limits and must not be exposed publicly.
- Search returns only TMDB's first results page; pagination is not implemented.
- Next-episode information is date-only and may not represent a UK broadcaster's
  schedule or availability.
- Watchlist, recent searches, Recently Viewed, viewing history, settings, movie
  status and TV progress exist only on the current device. Clearing local data
  can remove them, and they are not a cloud backup.
- Authentication, accounts, cloud sync, databases, and episode-level tracking
  for older seasons are not implemented.
- App icons and the native splash image remain placeholder assets.

## Verification baseline

Before a milestone is considered complete:

- Expo lint and TypeScript checks must pass.
- Relevant automated tests must pass.
- Expo SDK dependency validation and an iOS export must pass.
- Exported mobile output must not contain the TMDB credential.
- The complete user flow, navigation, errors, and persistence must be tested on a
  physical iPhone through Expo Go.

Project setup and startup commands belong in `mobile/README.md`. Future work and
completion checklists belong in `docs/ROADMAP.md`. Production hosting and public
distribution decisions belong in `docs/DEPLOYMENT-AND-DISTRIBUTION.md`.

## Latest automated milestone

The 13 September Home/Profile extension has passed automated and browser checks;
its physical iPhone pass is pending. See
`docs/verification/2026-09-13-roadmap-progress.md` for the commands, browser
coverage, screenshots, storage semantics, and remaining work. Earlier statements
about completed physical-device testing apply to those earlier increments only.

## Development approach

Build the smallest useful version of each feature, keep changes understandable,
and explain new React Native, TypeScript, API, routing, and persistence concepts
as they are introduced. Avoid adding backend services, authentication, databases,
or complex state management until the application needs them.
