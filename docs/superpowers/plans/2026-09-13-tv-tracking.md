# TV Tracking and Air-Date Countdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local season tracking, Watchlist progress, and a date-only next-episode countdown without adding per-item network requests.

**Architecture:** Extend the existing server detail response with a shape-validated next-episode candidate, then let a pure mobile date utility reject past dates using the device-local calendar date. Store versioned TV-progress records through a small AsyncStorage adapter; details synchronize trackable seasons, while Watchlist reads the whole local collection once on focus.

**Tech Stack:** Expo SDK 57, Expo Router, React Native, TypeScript, Node test runner, AsyncStorage, existing local TMDB proxy.

**Spec:** `docs/superpowers/specs/2026-09-12-tv-tracking-design.md`

## Global Constraints

- Display dates as UK `DD/MM/YYYY`, but compare ISO dates as calendar components rather than timestamps.
- The server validates shape and real ISO dates; mobile alone decides whether a date is past.
- Use AsyncStorage key `showtime.tv-progress.v1`.
- Store season arrays deduplicated and sorted ascending.
- Watchlist reads local progress once and makes zero per-item network requests.
- Keep tracking independent from Watchlist membership.
- Do not add episode tracking, background refresh, authentication, databases, or global state.

---

### Task 1: Server next-episode candidate

**Files:**
- Modify: `mobile/server/details.test.mjs`
- Modify: `mobile/server/details.mjs`

**Interfaces:**
- Produces: nullable `details.nextEpisode` with `{ id, name, seasonNumber, episodeNumber, airDate }`.

- [ ] Add server tests for a valid candidate, missing value, malformed/impossible date, and structurally valid past date.
- [ ] Run `npm run test:search` and verify the new assertions fail because `nextEpisode` is absent.
- [ ] Add real ISO-calendar validation and restricted field mapping. Do not compare with the current date.
- [ ] Run `npm run test:search` and verify all server tests pass.

### Task 2: Mobile date-only rules and detail contract

**Files:**
- Create: `mobile/tests/air-date-rules.test.mjs`
- Create: `mobile/src/services/air-date-rules.ts`
- Modify: `mobile/src/services/details.ts`
- Modify: `mobile/package.json`

**Interfaces:**
- Produces: `parseIsoCalendarDate`, `formatUkDate`, `getCountdownLabel`, `getDeviceLocalIsoDate`, and `normalizeNextEpisode`.
- Produces: `MediaDetails.nextEpisode`, already null when missing, malformed, or past relative to device-local today.

- [ ] Write tests for real/invalid ISO dates, UK formatting, today, tomorrow, multiple days away, month/year boundaries, missing data, and past normalization.
- [ ] Run the focused test and verify it fails because the module is absent.
- [ ] Implement numeric calendar-component validation and comparison without parsing ISO strings as timestamps.
- [ ] Normalize the server candidate in `fetchDetails` using device-local today and validate the extended response.
- [ ] Add `test:tracking` to run all new pure tracking/date tests, then verify date tests pass.

### Task 3: Deterministic local progress rules and storage

**Files:**
- Create: `mobile/tests/tv-progress-rules.test.mjs`
- Create: `mobile/src/services/tv-progress-rules.ts`
- Create: `mobile/src/services/tv-progress-storage.ts`
- Create: `mobile/src/services/tv-progress.ts`
- Modify: `mobile/package.json`

**Interfaces:**
- Produces: `TvProgress`, `ProgressLoadResult`, parsing/merging, trackable-season derivation, synchronization, toggling, progress calculation, and one versioned storage adapter.

- [ ] Write failing tests for missing/empty storage, unavailable malformed/read-error states, valid-record salvage, duplicate-record union, invalid values, specials exclusion, stale watched values, currently airing/future seasons, sorting, and write failures.
- [ ] Run the focused test and verify it fails because progress modules are absent.
- [ ] Implement pure normalized rules so every output season array is unique and sorted ascending.
- [ ] Implement an injectable storage adapter that never writes after an unavailable read and preserves errors for the UI.
- [ ] Connect the adapter to AsyncStorage under `showtime.tv-progress.v1`.
- [ ] Run `npm run test:tracking` and verify all date and progress tests pass.

### Task 4: TV details tracking UI

**Files:**
- Modify: `mobile/src/components/media-details-screen.tsx`

**Interfaces:**
- Consumes: normalized `nextEpisode` and TV-progress service.
- Produces: next-air-date card, watched total, and independent controls for regular seasons.

- [ ] Render the next episode with `Sx Ey`, optional title, `DD/MM/YYYY`, and countdown/missing copy.
- [ ] Synchronize trackable seasons after TV details load while retaining stale watched values.
- [ ] Render specials without controls and regular seasons with watched/unwatched buttons.
- [ ] Apply optimistic updates with a snapshot, disable repeat presses, and restore the snapshot with a small error message after a failed write.
- [ ] Keep movie details unchanged and run lint, TypeScript, and `npm run test:tracking`.

### Task 5: Local-only Watchlist progress

**Files:**
- Create: `mobile/tests/watchlist-progress.test.mjs`
- Create: `mobile/src/services/watchlist-progress.ts`
- Modify: `mobile/src/app/(tabs)/watchlist.tsx`

**Interfaces:**
- Produces: one local Watchlist/progress load and per-row progress labels with no network dependency.

- [ ] Write a failing loader test using multiple TV items that asserts one Watchlist read, one progress read, and no per-item/network callback.
- [ ] Implement the local combiner/loader and verify the focused test passes.
- [ ] Load progress once on Watchlist focus and show `N of M seasons watched`, unavailable copy, or `Open details to load season progress`.
- [ ] Keep movie rows unchanged and ensure Watchlist removal never modifies progress.
- [ ] Run lint, TypeScript, and all automated tests.

### Task 6: Documentation and release verification

**Files:**
- Modify: `docs/PROJECT_CONTEXT.md`
- Modify: `docs/ROADMAP.md`
- Modify: `mobile/README.md`

- [ ] Document the versioned local model, UK date-only limitation, startup/test commands, and physical verification status without claiming unperformed checks.
- [ ] Run `git diff --check`, lint, TypeScript, every test suite, `expo install --check`, and an iOS export.
- [ ] On physical iPhone, verify season toggles, currently airing behavior, specials, Watchlist totals, restart persistence, remove/re-add persistence, upcoming/missing episode copy, and unchanged movie behavior.
- [ ] After physical verification, mark Phase 5 complete and create a human-readable commit.
