# Latest-Season Episode Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add accurate newest-season episode dates and local watched controls while preserving existing season tracking.

**Architecture:** The local Node proxy makes a second TMDB request for the highest regular season and returns a restricted episode summary. Mobile date rules select a fallback upcoming episode, and versioned AsyncStorage v2 stores newest-season progress for details and Watchlist views.

**Tech Stack:** Node.js test runner, TypeScript, React Native 0.86, React 19.2, Expo SDK 57, AsyncStorage 2.2.

**Spec:** `docs/superpowers/specs/2026-09-13-latest-season-episode-tracking-design.md`

## Global Constraints

- TMDB remains server-only and its token must never enter the mobile bundle or logs.
- Use device-local date-only comparisons and UK `DD/MM/YYYY` display.
- Fetch only the newest regular season when TV details open; Watchlist remains local-only.
- Keep Specials visible and untracked.
- Keep full historical episode tracking outside this phase.
- Preserve valid v1 season progress and sort all persisted number arrays.

---

### Task 1: Map newest-season episodes on the local server

**Files:**
- Modify: `mobile/server/details.test.mjs`
- Modify: `mobile/server/details.mjs`

**Interfaces:**
- Produces: `details.latestSeason` as `{ seasonNumber, name, episodes } | null`.
- Each episode is `{ id, name, seasonNumber, episodeNumber, airDate }`, with nullable name/date.

- [ ] Add a server test whose TV fixture has regular seasons and whose season endpoint returns valid, malformed, and private episode fields. Assert exactly the restricted sorted episode response and both upstream URLs.
- [ ] Run `npm run test:search` and confirm the new assertion fails because `latestSeason` is absent.
- [ ] Add newest-season selection, a guarded second TMDB request, episode validation, and `latestSeason: null` for movies or optional season-request failure.
- [ ] Add tests proving a failed season request preserves TV details and movies never request a season.
- [ ] Run `npm run test:search` and confirm all server tests pass.

### Task 2: Derive fallback dates and episode availability

**Files:**
- Modify: `mobile/tests/air-date-rules.test.mjs`
- Modify: `mobile/src/services/air-date-rules.ts`
- Modify: `mobile/src/services/details.ts`

**Interfaces:**
- Produces: `selectNextEpisode(primary, candidates, todayIso)`.
- Produces: `getSeasonAirDateLabel(airDate, todayIso)`.
- Extends `MediaDetails` with `latestSeason`.

- [ ] Add tests for primary next-episode preference, fallback to the earliest non-past candidate, malformed/past rejection, and deterministic episode ordering.
- [ ] Add tests expecting `Starts 07/10/2026`, `Premiered 01/10/2025`, and an unavailable-date label.
- [ ] Run `npm run test:tracking` and confirm failures identify the missing helpers.
- [ ] Implement the helpers with existing ISO date-only parsing and normalise `latestSeason` in `fetchDetails`.
- [ ] Run `npm run test:tracking` and confirm the date tests pass.

### Task 3: Migrate progress storage and add episode rules

**Files:**
- Modify: `mobile/tests/tv-progress-rules.test.mjs`
- Modify: `mobile/src/services/tv-progress-rules.ts`
- Modify: `mobile/src/services/tv-progress-storage.ts`
- Modify: `mobile/src/services/tv-progress.ts`

**Interfaces:**
- Produces: v2 `TvProgress` and `EpisodeProgress` types from the design.
- Produces: `deriveEpisodeMetadata`, `synchronizeTrackingMetadata`, and `setEpisodeWatched`.
- Storage produces: `synchronize(...)`, `setSeasonWatched(...)`, and `setEpisodeWatched(...)`.

- [ ] Add failing tests for v1 migration, v2 malformed handling, duplicate episode-record merging, sorted arrays, stale watched preservation, trackable episode derivation, and newest-season completion.
- [ ] Add a failing storage test proving v2 is preferred, valid v1 is used only when v2 is missing, and the next write uses `showtime.tv-progress.v2`.
- [ ] Run `npm run test:tracking` and confirm failures are caused by the missing v2 model.
- [ ] Implement v2 parsing/normalisation and in-memory v1 migration without deleting or rewriting v1 during reads.
- [ ] Implement episode metadata synchronisation and episode watched toggles.
- [ ] Run `npm run test:tracking` and confirm all progress tests pass.

### Task 4: Present episode progress locally in Watchlist

**Files:**
- Modify: `mobile/tests/watchlist-progress.test.mjs`
- Modify: `mobile/src/services/watchlist-progress.ts`

**Interfaces:**
- Consumes: v2 `TvProgress` and episode completion rules.
- Produces: a combined local season and latest-season episode label.

- [ ] Add a failing test for `14 of 15 seasons watched · S15: 3 of 4 aired episodes watched` and retain the one-read-per-collection assertion.
- [ ] Run `npm run test:tracking` and confirm only the new label assertion fails.
- [ ] Update label calculation using local v2 data only.
- [ ] Run `npm run test:tracking` and confirm Watchlist tests pass.

### Task 5: Add newest-season episode controls to TV details

**Files:**
- Modify: `mobile/src/components/media-details-screen.tsx`

**Interfaces:**
- Consumes: normalised `latestSeason`, date helpers, v2 progress rules, and storage functions.
- Produces: exact season dates, next-episode fallback, and optimistic episode controls with rollback.

- [ ] Replace future-season copy with the exact `Starts DD/MM/YYYY` label and show UK premiere dates for started seasons.
- [ ] Render newest-season episode rows with watched controls for aired/today episodes and disabled date/countdown labels for future or unknown dates.
- [ ] Keep older-season and unavailable-latest-season fallback controls.
- [ ] Add optimistic episode updates using the existing rollback helper and a focused error message.
- [ ] Run tracking tests, lint, and TypeScript checks.

### Task 6: Update documentation and complete verification

**Files:**
- Modify: `docs/PROJECT_CONTEXT.md`
- Modify: `docs/ROADMAP.md`
- Modify: `mobile/README.md`
- Modify: `mobile/package.json` only if the existing tracking test command needs another test file.

**Interfaces:**
- Documents the implemented Phase 5 scope and physical test checklist.

- [ ] Move newest-season episode tracking into Phase 5 while keeping all-season episode tracking in Future Refinements.
- [ ] Document the second details request, v2 migration, date behavior, and iPhone checks.
- [ ] Run `git diff --check`.
- [ ] Run `npm run test:search`, `npm run test:history`, `npm run test:watchlist`, `npm run test:tracking`, `npm run lint`, `npx tsc --noEmit`, `npx expo install --check`, and an iOS Expo export to an ignored directory.
- [ ] Confirm the TMDB token is absent from the export and `.env.local` remains ignored.
- [ ] Present the code/documentation diff and physical iPhone checklist before committing.
