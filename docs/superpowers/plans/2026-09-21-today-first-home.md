# Today-first Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show today's and this week's dated releases from saved TV shows before secondary Home content, without using watched status to filter the schedule.

**Architecture:** A bounded public schedule route in the shared TMDB layer supplies dated regular episodes and an explicit coverage flag. The app validates and caches each saved show's schedule locally, then derives Today, This Week, and Coming Soon from one date-only list. Home reads cache first and refreshes missing or stale entries with limited concurrency; account sync continues to own only Watchlist membership.

**Tech Stack:** Expo 57, React Native Web, Expo Router, TypeScript, AsyncStorage, Node test runner, shared JavaScript TMDB handlers, local Node API, Cloudflare Worker.

**Spec:** `docs/superpowers/specs/2026-09-21-today-first-home-design.md`

## Global Constraints

- Work from `feature/cloudflare-api` in a separate worktree; inspect fresh status before editing. Do not use the dirty rollback checkout or alter account work.
- Keep the four tabs and the existing Watchlist as the only followed-show source. Keep movies in Watchlist and all watched/progress features elsewhere.
- Use current branding/tokens. Phone is single column; desktop is centered and responsive. Full dates are DD/MM/YYYY.
- Air dates are calendar dates. Do not invent times, UK availability, missing dates, or complete coverage after partial fetching.
- Keep TMDB credentials on the server. Use shared handlers for local and production. Do not deploy or change D1/auth/sync schema.
- Preserve cached rows during refresh; distinguish new user, confirmed empty, loading, partial coverage, and refresh error.

## File map

| Responsibility | Files |
| --- | --- |
| Public route, validation and TMDB mapping | `shared/tmdb-api/request.mjs`, new `shared/tmdb-api/schedule.mjs`, matching `.test.mjs` files |
| Local and production routing | `local-uat/api/search.mjs`, `local-uat/api/search.test.mjs`, `production/api/src/index.ts`, `production/api/src/logging.ts`, `production/api/src/cache.ts`, `production/api/src/rate-limit.ts`, `production/api/test/index.spec.ts`, `production/api/test/cache.spec.ts`, `production/api/test/rate-limit.spec.ts` |
| Client schedule response/cache/refresh | new `app/src/services/schedule-api.ts`, `app/src/services/tv-schedule.ts`, `app/src/services/tv-schedule-rules.ts`, `app/src/services/tv-schedule-storage.ts`, `app/src/services/home-data.ts`, app schedule/Home tests |
| Home presentation | `app/src/app/(tabs)/index.tsx`, `app/src/components/upcoming-section.tsx` (replace its single-next-episode presentation), app date helpers only if needed |
| Current docs | `app/README.md`, `local-uat/README.md`, `production/README.md`, `docs/PROJECT_CONTEXT.md` for changed route and schedule behaviour |

## Review Focus

1. One show with multiple episodes on the same date must occupy one collapsed row while expansion exposes every episode.
2. A watched episode and a visit to TV details must not change the dated release list or write watched progress.
3. A partial or failed API result must never turn into a confident “nothing scheduled” message.
4. A saved show arriving through remote sync must become eligible without a detail-page visit; removal must disappear on refresh.
5. Sunday/Monday and December/January boundaries must put each episode in exactly one section using local calendar dates.

---

### Task 1: Add a bounded, honest schedule API

**Files:** Create `shared/tmdb-api/schedule.mjs`, `shared/tmdb-api/schedule.test.mjs`; modify `shared/tmdb-api/request.mjs`, `shared/tmdb-api/request.test.mjs`.

**Interfaces:** Produce `handleSchedule(route, { token, fetchTmdbJson }) -> Promise<{ status, body }>` where `route` has `{ kind: 'tv-schedule', id, cacheKey, cost }`. A 200 body is `{ schedule: { id, title, posterUrl, episodes, coverage } }`; each episode is `{ id, name, seasonNumber, episodeNumber, airDate }` with a valid ISO calendar date.

```js
// Route and response contract used by both adapters.
const route = { kind: 'tv-schedule', id: 123, cacheKey: '/schedule/tv/123', cost: 13 };
const body = { schedule: { id: 123, title: 'Example', posterUrl: null,
  coverage: 'complete', episodes: [{ id: 9, name: null, seasonNumber: 2,
    episodeNumber: 1, airDate: '2026-09-22' }] } };
```

- [ ] **Step 1: Write route tests.** Assert canonical `GET /schedule/tv/123` parses as `tv-schedule`, while zero/unsafe IDs, query strings, unsupported methods and extra path parts are rejected; OPTIONS retains the existing preflight contract.
- [ ] **Step 2: Run `node --test shared/tmdb-api/request.test.mjs`.** Expect the new valid route test to fail before implementation.
- [ ] **Step 3: Add the exact route.** Parse only `/schedule/tv/([1-9]\d*)`; require a safe integer; set a canonical cache key and a work cost covering the capped upstream call count. Do not widen existing detail routes.
- [ ] **Step 4: Write handler tests.** Fixture a TV with two regular seasons and specials; assert all dated regular episodes appear in date order, undated/malformed episodes stay out, duplicate IDs collapse, and no viewing progress input exists. Add failures for a missing or malformed primary show, one failed season, more seasons than the cap, and an episode-result cap; incomplete inputs return an error or `coverage: 'partial'`, never a confident empty list. The returned list and JSON body must be bounded.
- [ ] **Step 5: Run `node --test shared/tmdb-api/schedule.test.mjs`.** Expect failure because the handler does not yet exist.
- [ ] **Step 6: Implement the smallest handler.** Fetch the TV summary, select the 12 newest regular seasons with positive episode counts, fetch at most three seasons concurrently, validate dates and IDs, and discard dates older than two days before the server's UTC date. Deduplicate and sort, then return the earliest 200 dated episodes. Return `complete` only if every eligible regular season succeeded without truncation. Include valid `next_episode_to_air` when its season is outside the cap, while keeping coverage partial. Reuse the shared `fetchTmdbJson` dependency and safe error response conventions.
- [ ] **Step 7: Run both focused tests; commit the shared route and handler.** Expected: pass. Suggested commit: `feat: add bounded TV schedule metadata route`.

### Task 2: Wire the schedule route into local and production APIs

**Files:** Modify `local-uat/api/search.mjs`, `local-uat/api/search.test.mjs`, `production/api/src/index.ts`, `production/api/src/logging.ts`, `production/api/src/cache.ts`, `production/api/src/rate-limit.ts`, `production/api/test/index.spec.ts`, `production/api/test/cache.spec.ts`, `production/api/test/rate-limit.spec.ts`; update affected environment README files.

**Interfaces:** Consume Task 1's `handleSchedule`. Local and production expose the same `GET /schedule/tv/:id` response; production applies existing origin checks, category rate limiting, work-cost reservation, 200-only cache and safe route logging.

- [ ] **Step 1: Add adapter tests.** Verify a valid local request reaches `handleSchedule`, invalid paths do not, and production tests exercise origin rejection, work-cost limit, 200 cache hit/miss, and no caching for 429/502 failures. A 200 partial schedule may be cached only for a short bounded TTL.
- [ ] **Step 2: Run `npm run local:test` and `npm --prefix production/api test -- --run`.** Expect new route tests to fail.
- [ ] **Step 3: Dispatch `tv-schedule` in local and production.** Keep shared mapping in `shared/`; local is an adapter only. Classify the route under detail-like limits, reserve its declared cost, add a safe logging name, and set a conservative cache TTL shorter for partial data. Do not touch auth routes or bindings.
- [ ] **Step 4: Run `npm run local:test`, `npm run production:check`, and `npm run test:structure`.** Expected: pass. Commit as `feat: expose TV schedule in local and production APIs`.

### Task 3: Refresh and cache schedules for saved shows

**Files:** Create `app/src/services/schedule-api.ts`; modify `app/src/services/tv-schedule.ts`, `app/src/services/tv-schedule-rules.ts`, `app/src/services/tv-schedule-storage.ts`, `app/src/services/home-data.ts`, `app/tests/tv-schedule.test.mjs`, `app/tests/home-data.test.mjs`; add a focused refresh test file if needed.

**Interfaces:** Produce `refreshSavedTvSchedules(watchlist, { force?: boolean })` returning `{ records, refreshError, coverage }`. Home owns the in-flight `refreshing` state. The cache record extends `TvSchedule` with `coverage` while old `v1` entries parse as partial. `loadHomeData` still preserves independent collection failures.

```ts
type ScheduleCoverage = 'complete' | 'partial';
type ScheduleRefreshResult = {
  records: TvSchedule[];
  refreshError: boolean;
  coverage: ScheduleCoverage;
};
```

- [ ] **Step 1: Test response validation and old-cache compatibility.** Reject wrong IDs, malformed dates, duplicate episodes and unbounded arrays. Read old `v1` snapshots without deleting them, but mark their coverage partial; refuse to overwrite unreadable storage. Assert saved movies never cause schedule requests.
- [ ] **Step 2: Test refresh behaviour.** A newly saved TV title is fetched without a detail visit; fresh cached titles make no request; stale titles refresh once; concurrent refreshes coalesce or serialize; a failed refresh preserves prior records and reports an error. Simulate a remote Watchlist addition and removal through the Home reload path.
- [ ] **Step 3: Run `node --no-warnings=ExperimentalWarning --experimental-strip-types --test app/tests/tv-schedule.test.mjs app/tests/home-data.test.mjs`.** Expect the new assertions to fail.
- [ ] **Step 4: Implement the client fetch and cache coordinator.** Use `getServerUrl()` and `GET /schedule/tv/:id`; validate before writing. Use a twelve-hour freshness period, at most two concurrent show requests, a force path for retry, and the existing serialized storage writer. Keep schedule cache local; do not add it to `sync.ts` or D1. Preserve old data until each successful replacement. Make `recordTvSchedule(details)` seed only missing records or update an already partial record; it must not replace a complete schedule with the detail page's newest-season snapshot.
- [ ] **Step 5: Connect Home's existing focus and `subscribeLibraryChanges` reload to the coordinator.** Load local collections and cached schedule first, show them, then start the network refresh. Watchlist changes determine eligible IDs; removals disappear from derived Home output without deleting unrelated storage. Keep `refreshing` in Home until network work settles.
- [ ] **Step 6: Run app schedule and Home tests, then `npm run app:check`.** Expected: pass. Commit as `feat: refresh saved TV schedules without detail visits`.

### Task 4: Derive date-only Home sections

**Files:** Modify `app/src/services/tv-schedule-rules.ts`, `app/src/services/air-date-rules.ts` only if a missing calendar helper is needed, and `app/tests/tv-schedule.test.mjs`.

**Interfaces:** Produce `getHomeSchedule(records, savedTvIds, todayIso)` returning `{ today, weekDays, comingSoon, coverage }`; each entry carries show identity, poster and episode metadata. Rendering consumes this object and never reads watched progress.

```ts
const view = getHomeSchedule(records, new Set([123]), '2026-09-21');
// view.today contains 21 September only; view.weekDays ends on Sunday 27 September.
// view.comingSoon begins on Monday 28 September.
```

- [ ] **Step 1: Add tests with explicit dates.** Assert Monday through Sunday grouping, today exclusion from This Week, Sunday leaving no remaining-week days, year boundary, original-air-date equality, same-day multi-episode grouping, duplicate episode prevention, chronological order, a distant next known release, and unchanged results when watched-progress fixtures change.
- [ ] **Step 2: Run `node --no-warnings=ExperimentalWarning --experimental-strip-types --test app/tests/tv-schedule.test.mjs`.** Expect failure for the new selector.
- [ ] **Step 3: Implement calendar-only selection.** Use ISO date comparisons and a weekday calculation from date components; never parse an air date as local midnight. Filter by saved TV IDs; group by show plus air date; sort day, title, season and episode. Derive premiere labels only from episode one and season number.
- [ ] **Step 4: Rerun the focused test and `npm run app:check`.** Expected: pass. Commit as `feat: derive Today and weekly release groups`.

### Task 5: Present the Today-first Home

**Files:** Modify `app/src/app/(tabs)/index.tsx`, `app/src/components/upcoming-section.tsx`; create `app/src/components/home-schedule-row.tsx` only if it keeps the section focused. Update `app/tests/home-data.test.mjs` for state transitions where testable without mirroring JSX.

**Interfaces:** Consume Task 4's `getHomeSchedule` and Task 3's refresh state. Navigate via existing `/tv/[id]`, `/watchlist`, and `/search` routes.

- [ ] **Step 1: Place Today directly after a compact header/Search affordance.** Render This Week and Coming Soon next, then a Watchlist poster strip containing both media types. Move Continue Watching, Recently Viewed, Watched Movies and optional Trending below. Reuse `BrandColors`, `Layout`, `Space`, `Radii` and existing poster components.
- [ ] **Step 2: Render schedule rows.** Include poster fallback, title, S/E, optional episode title, Today/date label, a whole-row link to TV details, and a separate accessible expand control for a same-day group. Use an in-place expansion for preview overflow; do not add dead See all links.
- [ ] **Step 3: Render distinct states.** First load gets row-shaped skeletons. No saved TV shows gets a Search link. Confirmed no release today says “Nothing new from your shows today” and includes the next known release when present. A fully checked empty schedule says no dates are announced. Partial coverage says the schedule may be incomplete. Refresh errors retain rows and show Retry; force retry bypasses freshness.
- [ ] **Step 4: Keep the local calendar current.** Recalculate on focus, `AppState` active and a day-change timer; never clear previous rows merely because a refresh begins.
- [ ] **Step 5: Check accessibility and layout manually.** Verify keyboard link/button order and expansion, labels, at least the existing minimum control size, narrow phone width, desktop maximum width, no horizontal overflow and light/dark theme. Capture phone and desktop screenshots in an ignored QA location.
- [ ] **Step 6: Run `npm run app:check`.** Expected: pass. Commit as `feat: make Home release schedule primary`.

### Task 6: End-to-end verification and current documentation

**Files:** Update `docs/PROJECT_CONTEXT.md` and the affected current README files. Add only focused tests needed to cover a failure found during verification.

**Interfaces:** No new product interfaces.

- [ ] **Step 1: Run `npm run check` from the repository root.** Expected: structure, shared/local, app and production checks pass.
- [ ] **Step 2: Run local/UAT with the documented startup command.** Verify a saved show appears without opening details first, opening the row does not change watched status, a same-day release group expands, a failed refresh retains cached rows, and Search/Watchlist/Profile still navigate.
- [ ] **Step 3: Capture phone and desktop screenshots and record their paths plus any unverified physical-device checks.** Verify empty, loading and error states with controlled fixtures or local API failure; do not use fictional fixture titles in production UI.
- [ ] **Step 4: Update current docs with the route, cache freshness/coverage rules, Home hierarchy and local/UAT verification commands.** Keep historic design/verification records intact.
- [ ] **Step 5: Review `git diff --check`, status and all changed files, then commit documentation as `docs: describe Today-first Home schedule`.** No deployment, push or merge is part of this plan.
