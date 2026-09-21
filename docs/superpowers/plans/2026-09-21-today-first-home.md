# Today-first Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the phone-browser Home show today's and this week's dated releases from saved TV shows before secondary content, without using watched status to filter the schedule.

**Architecture:** A bounded public schedule route in the shared TMDB layer supplies dated regular episodes with per-season coverage. The app replaces checked seasons, retains marked stale data from unchecked seasons, and derives Today, This Week, and Coming Soon from one date-only list. Home reads cache first and refreshes eligible shows incrementally with limited concurrency; account sync continues to own only Watchlist membership.

**Tech Stack:** Mobile-first React Native Web on Expo 57, Expo Router, TypeScript, AsyncStorage, Node test runner, shared JavaScript TMDB handlers, local Node API, Cloudflare Worker.

**Spec:** `docs/superpowers/specs/2026-09-21-today-first-home-design.md`

## Global Constraints

- Work from `feature/cloudflare-api` in a separate worktree; inspect fresh status before editing. Do not use the dirty rollback checkout or alter account work.
- This is a mobile-first responsive website. It must work in a phone browser without native installation and at desktop width using the same approved mockup hierarchy.
- Scope is Home and its schedule metadata only. Do not improve Profile/Recent Activity, Search, or build a separate Upcoming screen.
- Keep the four tabs and the existing Watchlist as the only followed-show source. Keep movies in Watchlist and all watched/progress features elsewhere.
- Use current branding/tokens. Phone is single column; desktop is centered and responsive. Full dates are DD/MM/YYYY.
- Air dates are calendar dates. Do not invent times, UK availability, missing dates, or complete coverage after partial fetching.
- Keep TMDB credentials on the server. Use shared handlers for local and production. Do not deploy or change D1/auth/sync schema.
- Preserve cached rows during refresh; distinguish new user, confirmed empty, loading, partial coverage, and refresh error.
- No deployment, push or merge is authorized.

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
3. A partial, stale or failed API result must never turn into a confident empty message; temporary partials retry earlier than cap-limited results.
4. A saved show arriving through remote sync must become eligible without a detail-page visit; removal must disappear on refresh.
5. Sunday/Monday and December/January boundaries must put each episode in exactly one section using local calendar dates.
6. A complete cache receiving a partial result must retain unchecked-season entries while replacing successfully checked seasons; a later complete result removes stale entries and an updated date replaces the old date.
7. With 30–50 saved shows and no cache, Home remains interactive, adds results incrementally, and never starts overlapping batches on repeated focus or sync events.

---

### Task 1: Add a bounded, honest schedule API

**Files:** Create `shared/tmdb-api/schedule.mjs`, `shared/tmdb-api/schedule.test.mjs`; modify `shared/tmdb-api/request.mjs`, `shared/tmdb-api/request.test.mjs`.

**Interfaces:** Produce `handleSchedule(route, { token, fetchTmdbJson, now }) -> Promise<{ status, body }>` where injectable `now` defaults to the current time and `route` has `{ kind: 'tv-schedule', id, cacheKey, cost }`. A 200 body is `{ schedule: { id, title, posterUrl, episodes, seasonCoverage, coverage, nextEpisode } }`. Each episode is `{ id, name, seasonNumber, episodeNumber, airDate }` with a valid ISO calendar date. `seasonCoverage` records every eligible regular season as `checked`, `unavailable` or `limited`; the client derives temporary versus cap-limited retry from those statuses.

```js
// Route and response contract used by both adapters.
const route = { kind: 'tv-schedule', id: 123, cacheKey: '/schedule/tv/123', cost: 13 };
const body = { schedule: { id: 123, title: 'Example', posterUrl: null,
  coverage: 'complete', nextEpisode: null,
  seasonCoverage: [{ seasonNumber: 2, status: 'checked' }],
  episodes: [{ id: 9, name: null, seasonNumber: 2,
    episodeNumber: 1, airDate: '2026-09-22' }] } };
```

- [ ] **Step 1: Write route tests.** Assert canonical `GET /schedule/tv/123` parses as `tv-schedule`, while zero/unsafe IDs, query strings, unsupported methods and extra path parts are rejected; OPTIONS retains the existing preflight contract.
- [ ] **Step 2: Run `node --test shared/tmdb-api/request.test.mjs`.** Expect the new valid route test to fail before implementation.
- [ ] **Step 3: Add the exact route.** Parse only `/schedule/tv/([1-9]\d*)`; require a safe integer; set a canonical cache key and a work cost covering the capped upstream call count. Do not widen existing detail routes.
- [ ] **Step 4: Write handler tests.** Fixture a TV with two regular seasons and specials; inject a fixed `now` and assert all dated regular episodes appear in date order, undated/malformed episodes stay out, duplicate IDs collapse, and no viewing progress input exists. A season-only air date must not create an episode-one date. Add failures for a missing or malformed primary show, one failed season, more seasons than the cap, and an episode-result cap. Assert `seasonCoverage` identifies checked, temporary-unavailable and deliberately limited seasons, and incomplete input never produces a confident empty list. The returned list and JSON body must be bounded.
- [ ] **Step 5: Run `node --test shared/tmdb-api/schedule.test.mjs`.** Expect failure because the handler does not yet exist.
- [ ] **Step 6: Implement the smallest handler.** Fetch the TV summary, select the 12 newest regular seasons with positive episode counts, fetch at most three seasons concurrently, validate dates and IDs, and discard dates older than two days before the server's UTC date. Deduplicate and sort, then return the earliest 200 dated episodes. Emit coverage for all eligible seasons, including omitted and failed ones; mark seasons touched by episode truncation `limited`. Return `complete` only if every eligible regular season succeeded without truncation. Include valid `next_episode_to_air` as a separate candidate when its season is not checked, without making coverage complete. Reuse the shared `fetchTmdbJson` dependency and safe error responses.
- [ ] **Step 7: Run both focused tests; commit the shared route and handler.** Expected: pass. Suggested commit: `feat: add bounded TV schedule metadata route`.

### Task 2: Wire the schedule route into local and production APIs

**Files:** Modify `local-uat/api/search.mjs`, `local-uat/api/search.test.mjs`, `production/api/src/index.ts`, `production/api/src/logging.ts`, `production/api/src/cache.ts`, `production/api/src/rate-limit.ts`, `production/api/test/index.spec.ts`, `production/api/test/cache.spec.ts`, `production/api/test/rate-limit.spec.ts`; update affected environment README files.

**Interfaces:** Consume Task 1's `handleSchedule`. Local and production expose the same `GET /schedule/tv/:id` response; production applies existing origin checks, category rate limiting, work-cost reservation, response-aware 200-only cache and safe route logging.

- [ ] **Step 1: Add adapter tests.** Verify a valid local request reaches `handleSchedule`, invalid paths do not, and production tests exercise origin rejection, work-cost limit, 200 cache hit/miss, and no caching for 429/502 failures. A complete or cap-limited 200 response gets the existing 600-second TTL; a 200 response with any `unavailable` season bypasses the server cache so an early retry can improve it.
- [ ] **Step 2: Run `npm run local:test` and `npm --prefix production/api test -- --run`.** Expect new route tests to fail.
- [ ] **Step 3: Dispatch `tv-schedule` in local and production.** Keep shared mapping in `shared/`; local is an adapter only. Classify the route under detail-like limits, reserve its declared cost, add a safe logging name, and make `withApiCache` skip storage when `seasonCoverage` contains `unavailable`. Leave its existing 600-second successful-detail TTL for complete and cap-limited schedules. Do not touch auth routes or bindings.
- [ ] **Step 4: Run `npm run local:test`, `npm run production:check`, and `npm run test:structure`.** Expected: pass. Commit as `feat: expose TV schedule in local and production APIs`.

### Task 3: Refresh and cache schedules for saved shows

**Files:** Create `app/src/services/schedule-api.ts`; modify `app/src/services/tv-schedule.ts`, `app/src/services/tv-schedule-rules.ts`, `app/src/services/tv-schedule-storage.ts`, `app/src/services/home-data.ts`, `app/tests/tv-schedule.test.mjs`, `app/tests/home-data.test.mjs`; add a focused refresh test file if needed.

**Interfaces:** Produce `refreshSavedTvSchedules(watchlist, { force?: boolean, onUpdate?: (records: TvSchedule[]) => void })` returning `Promise<{ records: TvSchedule[]; failedIds: number[] }>`. `onUpdate` runs after each successful per-show merge so Home can render incrementally. Home owns the in-flight `refreshing` state. The cache record extends `TvSchedule` with `seasonCoverage`, `coverage`, and the last successful API check; old `v1` detail snapshots parse as `legacy` and do not inherit API freshness. `loadHomeData` still preserves independent collection failures.

```ts
type SeasonStatus = 'checked' | 'unavailable' | 'limited';
type SeasonCoverage = { seasonNumber: number; status: SeasonStatus };
type ScheduleCoverage = 'complete' | 'partial' | 'legacy';
type ScheduleRefreshResult = {
  records: TvSchedule[];
  failedIds: number[];
};
```

- [ ] **Step 1: Test response validation and old-cache compatibility.** Reject wrong IDs, malformed dates, duplicate episodes, invalid season-coverage statuses and unbounded arrays. Read old `v1` snapshots without deleting them, mark them legacy and eligible immediately even if their detail timestamp is recent; refuse to overwrite unreadable storage. Assert saved movies never cause schedule requests.
- [ ] **Step 2: Test per-season merges.** Start with a complete cached show; return a partial response that checked season 2 and failed season 3. Assert season 2 is replaced, season 3's prior upcoming episodes remain marked stale, and overall coverage is partial. Then return a complete response and assert stale entries disappear. Reschedule one episode in a checked season and assert its old date is removed rather than duplicated. A limited season upserts by ID/season-episode identity and retains unmatched cached entries with incomplete status.
- [ ] **Step 3: Test freshness and refresh behaviour with a controllable clock.** Complete and cap-limited results wait 12 hours; temporary partials retry after 30 minutes; network/5xx failures retry after 15 minutes without changing the last successful check. A 429 pauses the queue for 60 seconds and permits one automatic retry; a second 429 backs off for 15 minutes. Legacy snapshots and newly saved TV titles fetch immediately. Repeated focus and remote/local Watchlist updates share one in-flight request per show and do not reset retry timers; removal during an in-flight request cannot reinsert a show into Home. Assert saved movies make no request.
- [ ] **Step 4: Run `node --no-warnings=ExperimentalWarning --experimental-strip-types --test app/tests/tv-schedule.test.mjs app/tests/home-data.test.mjs`.** Expect the new assertions to fail.
- [ ] **Step 5: Implement validation, per-season merge and the client coordinator.** Use `getServerUrl()` and `GET /schedule/tv/:id`. Replace every `checked` season as a set; retain `unavailable` seasons; upsert `limited` seasons by stable identity. Never write a new successful-check time after HTTP/network failure. Use at most two concurrent show requests and a shared per-show single-flight map. Dispatch no more than six new show requests per minute under the current 100-work-unit/minute production budget (route cost 13); after 429 pause for 60 seconds, retry once, then back off 15 minutes if it repeats. Keep retry times in an in-memory ledger so repeated focus does not loop. A manual Retry bypasses client freshness but respects the server limit. Keep schedule cache local and out of `sync.ts`/D1. Make `recordTvSchedule(details)` seed missing records only; it must not replace API-checked data.
- [ ] **Step 6: Connect Home's existing focus and `subscribeLibraryChanges` reload to the coordinator.** Load local collections and cached schedule first, show them, then start the network queue. Use `onUpdate` after each show so Home incorporates results immediately. A new saved show joins the queue; a removed show is filtered from derived output even if an old request finishes. Keep `refreshing` in Home until current eligible work settles.
- [ ] **Step 7: Run app schedule and Home tests, then `npm run app:check`.** Expected: pass. Commit as `feat: refresh saved TV schedules without detail visits`.

### Task 4: Derive date-only Home sections

**Files:** Modify `app/src/services/tv-schedule-rules.ts`, `app/src/services/air-date-rules.ts` only if a missing calendar helper is needed, and `app/tests/tv-schedule.test.mjs`.

**Interfaces:** Produce `getHomeSchedule(records, savedTvIds, todayIso)` returning `{ today, weekDays, comingSoon, coverage }`; each entry carries show identity, poster and episode metadata. Rendering consumes this object and never reads watched progress.

```ts
const view = getHomeSchedule(records, new Set([123]), '2026-09-21');
// view.today contains 21 September only; view.weekDays ends on Sunday 27 September.
// view.comingSoon begins on Monday 28 September.
```

- [ ] **Step 1: Add tests with explicit dates.** Assert Monday through Sunday grouping, today exclusion from This Week, Sunday yielding no remaining-week section even when Today has releases, year boundary, original-air-date equality, same-day multi-episode grouping, duplicate episode prevention, chronological order, a distant next known release, and unchanged results when watched-progress fixtures change. A season-only premiere date must not create an episode row.
- [ ] **Step 2: Run `node --no-warnings=ExperimentalWarning --experimental-strip-types --test app/tests/tv-schedule.test.mjs`.** Expect failure for the new selector.
- [ ] **Step 3: Implement calendar-only selection.** Use ISO date comparisons and a weekday calculation from date components; never parse an air date as local midnight. Filter by saved TV IDs; group by show plus air date; sort day, title, season and episode. Derive premiere labels only from episode one and season number.
- [ ] **Step 4: Rerun the focused test and `npm run app:check`.** Expected: pass. Commit as `feat: derive Today and weekly release groups`.

### Task 5: Present the Today-first Home

**Files:** Modify `app/src/app/(tabs)/index.tsx`, `app/src/components/upcoming-section.tsx`; create `app/src/components/home-schedule-row.tsx` only if it keeps the section focused. Update `app/tests/home-data.test.mjs` for state transitions where testable without mirroring JSX.

**Interfaces:** Consume Task 4's `getHomeSchedule` and Task 3's refresh state. Navigate via existing `/tv/[id]`, `/watchlist`, and `/search` routes.

- [ ] **Step 1: Place Today directly after a compact header/Search affordance.** Render This Week and Coming Soon next, then a strip headed exactly “Your Watchlist” containing both media types. Move Continue Watching, Recently Viewed, Watched Movies and optional Trending below as compact previews. Reuse `BrandColors`, `Layout`, `Space`, `Radii` and existing poster components; do not change other tab content or create a separate Upcoming route.
- [ ] **Step 2: Render schedule rows.** Include poster fallback, title, S/E, optional episode title, Today/date label, a whole-row link to TV details, and a separate accessible expand control for a same-day group. Use an in-place expansion for preview overflow; do not add dead See all links.
- [ ] **Step 3: Render distinct provider-neutral states.** First load gets row-shaped skeletons without hiding the rest of Home. No saved TV shows says “Add TV shows to your Watchlist to see what’s coming up.” with a Search link. Only when every saved show has a fresh complete check may Today say “Nothing new from your shows today.” with the next known release beneath it, or the schedule say “No upcoming episode dates available yet.” Partial or stale coverage says “Schedule may be incomplete.” Refresh failure says “Couldn’t update your schedule.” with Retry and retains rows. Disable Retry while its request runs; a manual retry still obeys the 429 queue pause. Never present confirmed-empty copy while a saved show is missing, loading, stale or unchecked. Leave existing TMDB attribution unchanged.
- [ ] **Step 4: Keep the local calendar current.** Recalculate on focus, `AppState` active and a day-change timer; never clear previous rows merely because a refresh begins.
- [ ] **Step 5: Check browser accessibility and layout manually at 360px, 390px and 1440px.** Verify Today starts in the first phone viewport, readable labels, keyboard link/button order and expansion, touch targets at least the existing minimum size, browser keyboard interactions, four-tab visibility around phone browser chrome, centered desktop maximum width, no horizontal overflow and light/dark theme. Capture phone-sized and desktop screenshots in an ignored QA location and label emulation separately from physical-device evidence.
- [ ] **Step 6: Run `npm run app:check`.** Expected: pass. Commit as `feat: make Home release schedule primary`.

### Task 6: End-to-end verification and current documentation

**Files:** Update `docs/PROJECT_CONTEXT.md` and the affected current README files. Add only focused tests needed to cover a failure found during verification.

**Interfaces:** No new product interfaces.

- [ ] **Step 1: Run `npm run check` from the repository root.** Expected: structure, shared/local, app and production checks pass.
- [ ] **Step 2: Run controlled local/UAT first-load fixtures with 30–50 saved TV shows and an empty schedule cache.** Use slow responses, one failed season, HTTP 429 and recovery. Verify Home stays interactive; each show's result appears on arrival; repeated focus and local/remote Watchlist events do not overlap batches; removal during an in-flight request never makes the show reappear. Record the time to first useful row and the time to finish or defer the queue, without claiming a fixed performance target that was not agreed.
- [ ] **Step 3: Exercise phone-browser flows and navigation.** At 360px and 390px, open Home, switch tabs and return, return after midnight, use browser Back, directly open and reload a TV-detail URL, and open a schedule row. Verify the row visit does not write watched progress, same-day groups expand, cached rows survive a failed refresh, and Search/Watchlist/Profile still navigate. Repeat layout at 1440px. Check empty/loading/error/partial states using controlled fixtures, keyboard and touch interaction, browser keyboard, browser-chrome overlap and horizontal overflow.
- [ ] **Step 4: Capture phone-sized and desktop screenshots, state whether each came from browser emulation or a physical browser, and list any iPhone Safari, Android Chrome or other checks not performed.** Do not use fictional fixture titles in production UI.
- [ ] **Step 5: Update current docs with the route, per-season merge and freshness/retry rules, Home hierarchy and local/UAT verification commands.** Keep historic design/verification records intact.
- [ ] **Step 6: Review `git diff --check`, status and all changed files, then commit documentation as `docs: describe Today-first Home schedule`.** Report exact command results and unverified checks. No deployment, push or merge is part of this plan.
