# Movie Watched Status and History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reliable local movie watched status, watched/completed Watchlist presentation and filters, and a Watched Movies Home rail without changing Watchlist membership or adding network requests.

**Architecture:** Store one validated display snapshot and watched timestamp per movie under a versioned AsyncStorage key. Movie Details owns watched writes, while Watchlist and Home each load the full local collection once and receive explicit status data through pure helper functions; no component reads storage per card.

**Tech Stack:** Expo SDK 57, React Native, Expo Router, TypeScript, AsyncStorage, Node test runner

**Spec:** `docs/superpowers/specs/2026-09-13-movie-watched-history-design.md`

## Global Constraints

- Use the AsyncStorage key `showtime.movie-progress.v1`.
- Keep one current watched record per positive TMDB movie ID.
- Retain the complete movie collection; Home previews only the newest 20.
- Sort persisted records by descending `watchedAt`, then ascending `movieId`.
- Keep movie watched status independent from Watchlist membership.
- Keep TV progress in `showtime.tv-progress.v2` and preserve its existing behavior.
- Treat missing storage and a valid empty array as available empty state.
- Treat invalid top-level storage and read exceptions as unavailable; never replace them automatically with an empty array.
- Roll back optimistic watched state after a failed write.
- Watchlist and Home must not request TMDB or the local Node server while loading status.
- Do not add repeat-viewing events, ratings, favourites, notes, notifications, recommendations, accounts, cloud sync, databases, background refresh or new dependencies.
- Preserve Home, Search, Watchlist and Profile navigation.

---

### Task 1: Movie Progress Rules and Versioned Storage

**Files:**
- Create: `mobile/src/services/movie-progress-rules.ts`
- Create: `mobile/src/services/movie-progress-storage.ts`
- Create: `mobile/src/services/movie-progress.ts`
- Create: `mobile/tests/movie-progress-rules.test.mjs`
- Modify: `mobile/package.json`

**Interfaces:**
- Produces: `WatchedMovieSnapshot`, `WatchedMovie`, and `MovieProgressLoadResult`.
- Produces: `parseMovieProgress(stored: string | null): MovieProgressLoadResult`.
- Produces: `findWatchedMovie(records, movieId): WatchedMovie | null`.
- Produces: `setMovieWatched(records, snapshot, watchedAt): WatchedMovie[]` and `setMovieUnwatched(records, movieId): WatchedMovie[]`.
- Produces: `formatLocalUkWatchedDate(timestamp): string | null`.
- Produces: `commitMovieProgressChange(previous, write)` for optimistic rollback.
- Produces: `createMovieProgressStorage(storage, now?)` with `load()`, `markWatched(snapshot)`, and `markUnwatched(movieId)`.
- Produces: AsyncStorage-bound `loadMovieProgress`, `markMovieWatched`, and `markMovieUnwatched`.

- [ ] **Step 1: Write failing parsing and normalization tests**

Create `movie-progress-rules.test.mjs` and import the planned rules. Assert the top-level contract:

```ts
assert.deepEqual(parseMovieProgress(null), { status: 'available', records: [] });
assert.deepEqual(parseMovieProgress('[]'), { status: 'available', records: [] });
assert.deepEqual(parseMovieProgress('{broken'), { status: 'unavailable', reason: 'malformed' });
assert.deepEqual(parseMovieProgress('{}'), { status: 'unavailable', reason: 'malformed' });
```

Use an array containing valid records, invalid IDs, blank titles, invalid optional fields, invalid timestamps and duplicate IDs. Assert that malformed records are ignored, strings are trimmed, the newest valid duplicate wins, and results sort newest first then by movie ID.

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

```powershell
node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/movie-progress-rules.test.mjs
```

Expected: FAIL because `movie-progress-rules.ts` does not exist.

- [ ] **Step 3: Implement the pure model and validation rules**

Define:

```ts
export type WatchedMovieSnapshot = {
  movieId: number;
  title: string;
  year: string | null;
  posterUrl: string | null;
};

export type WatchedMovie = WatchedMovieSnapshot & {
  watchedAt: string;
};

export type MovieProgressLoadResult =
  | { status: 'available'; records: WatchedMovie[] }
  | { status: 'unavailable'; reason: 'malformed' | 'read-error' };
```

Accept positive safe IDs, non-empty trimmed titles, string-or-null year/poster fields, and exact ISO instants produced by `Date.prototype.toISOString()`. Normalize duplicate IDs by the newest timestamp; when timestamps tie, retain the first valid stored record. Sort descending by timestamp then ascending by ID.

Implement updates without mutating their inputs:

```ts
setMovieWatched(records, snapshot, watchedAt)
setMovieUnwatched(records, movieId)
findWatchedMovie(records, movieId)
```

`setMovieWatched` replaces the same ID's snapshot and timestamp. `setMovieUnwatched` removes only that ID. Invalid update inputs return the normalized prior collection.

- [ ] **Step 4: Add date-formatting and rollback tests, then implement them**

Assert that `formatLocalUkWatchedDate('2026-09-13T12:00:00.000Z')` returns `13/09/2026` in the project timezone and invalid input returns `null`. Implement local calendar formatting with `getDate()`, `getMonth()` and `getFullYear()` rather than slicing the UTC timestamp.

Test both rollback paths:

```ts
assert.deepEqual(
  await commitMovieProgressChange(previous, async () => next),
  { saved: true, records: next },
);
assert.deepEqual(
  await commitMovieProgressChange(previous, async () => { throw new Error('write'); }),
  { saved: false, records: previous },
);
```

- [ ] **Step 5: Write failing storage-adapter tests**

Use an injected storage double and fixed clock:

```ts
const service = createMovieProgressStorage(storage, () => '2026-09-13T12:00:00.000Z');
```

Assert that `load()` reads only `showtime.movie-progress.v1`, returns `read-error` after `getItem` rejects, and never writes during a read. Assert that `markWatched(snapshot)` and `markUnwatched(movieId)` read the current collection, write normalized JSON once, and return the saved collection. With malformed top-level storage, both mutations must reject with `MovieProgressUnavailableError` and perform zero writes. A `setItem` exception must reject.

- [ ] **Step 6: Implement the storage adapter and AsyncStorage binding**

In `movie-progress-storage.ts`, define:

```ts
export const MOVIE_PROGRESS_KEY = 'showtime.movie-progress.v1';
export class MovieProgressUnavailableError extends Error {}

export function createMovieProgressStorage(
  storage: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
  },
  now = () => new Date().toISOString(),
): {
  load: () => Promise<MovieProgressLoadResult>;
  markWatched: (snapshot: WatchedMovieSnapshot) => Promise<WatchedMovie[]>;
  markUnwatched: (movieId: number) => Promise<WatchedMovie[]>;
};
```

Every mutation must load before writing and reject unavailable data. In `movie-progress.ts`, bind the factory to AsyncStorage and export its three operations.

- [ ] **Step 7: Add the focused package script and run verification**

Add:

```json
"test:movies": "node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/movie-progress-rules.test.mjs"
```

Run:

```powershell
npm run test:movies
npx tsc --noEmit
npm run lint
```

Expected: every command exits 0.

- [ ] **Step 8: Commit the movie-progress foundation**

```powershell
git add -- mobile/src/services/movie-progress-rules.ts mobile/src/services/movie-progress-storage.ts mobile/src/services/movie-progress.ts mobile/tests/movie-progress-rules.test.mjs mobile/package.json
git commit -m "Add local movie watched storage"
```

---

### Task 2: Movie Details Watched Control

**Files:**
- Create: `mobile/src/components/movie-watched-control.tsx`
- Modify: `mobile/src/components/media-details-screen.tsx`
- Modify: `mobile/tests/movie-progress-rules.test.mjs`

**Interfaces:**
- Consumes: movie-progress load/update operations and `WatchedMovieSnapshot` from Task 1.
- Produces: `createWatchedMovieSnapshot(details)` in the pure rules module.
- Produces: `MovieWatchedControl` that loads, retries, marks watched/unwatched and rolls back failed optimistic state.

- [ ] **Step 1: Write a failing Details snapshot test**

Add a test for:

```ts
assert.deepEqual(createWatchedMovieSnapshot({
  id: 272,
  title: 'Batman Begins',
  releaseDate: '2005-06-15',
  posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
}), {
  movieId: 272,
  title: 'Batman Begins',
  year: '2005',
  posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
});
```

Also assert that a null release date yields `year: null`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run `npm run test:movies`.

Expected: FAIL because `createWatchedMovieSnapshot` is not exported.

- [ ] **Step 3: Implement snapshot conversion**

Add this pure helper to `movie-progress-rules.ts`:

```ts
export function createWatchedMovieSnapshot(details: {
  id: number;
  title: string;
  releaseDate: string | null;
  posterUrl: string | null;
}): WatchedMovieSnapshot {
  return {
    movieId: details.id,
    title: details.title,
    year: details.releaseDate?.slice(0, 4) ?? null,
    posterUrl: details.posterUrl,
  };
}
```

- [ ] **Step 4: Build the isolated watched control**

`MovieWatchedControl` accepts one `snapshot`. On mount it calls `loadMovieProgress`; available data selects the matching record, while unavailable data shows `Movie watched status is unavailable.` and a `Try again` action. The rest of Details must remain usable.

Render a separate outlined control below the Watchlist control:

- unwatched: `Mark as watched`
- watched: `Mark as unwatched`
- saving: `Updating…`
- watched date: `Watched DD/MM/YYYY`

On press, retain the previous record, update the visible state optimistically, call `markMovieWatched(snapshot)` or `markMovieUnwatched(movieId)`, and reconcile with the returned collection. If persistence rejects, restore the previous record and show `Could not update watched status. Please try again.` Disable the button while loading, unavailable or saving and expose disabled/busy accessibility state.

- [ ] **Step 5: Mount the control only for movies**

In `DetailsContent`, render:

```tsx
{details.mediaType === 'Movie' && (
  <MovieWatchedControl snapshot={createWatchedMovieSnapshot(details)} />
)}
```

Keep Watchlist state, Recently Viewed recording and TV tracking independent. Do not place movie-progress state directly in the already broad Details component.

- [ ] **Step 6: Run focused and static checks**

```powershell
npm run test:movies
npx tsc --noEmit
npm run lint
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit the Details control**

```powershell
git add -- mobile/src/components/movie-watched-control.tsx mobile/src/components/media-details-screen.tsx mobile/src/services/movie-progress-rules.ts mobile/tests/movie-progress-rules.test.mjs
git commit -m "Add movie watched controls"
```

---

### Task 3: Compose Local Watchlist Status

**Files:**
- Modify: `mobile/src/services/watchlist-progress.ts`
- Modify: `mobile/tests/watchlist-progress.test.mjs`

**Interfaces:**
- Consumes: `MovieProgressLoadResult`, `ProgressLoadResult`, `calculateTvProgress`, and the three local loaders.
- Produces: `WatchlistStatus = 'watched' | 'to-watch' | 'unknown'`.
- Produces: `loadWatchlistProgressData({ loadWatchlist, loadTvProgress, loadMovieProgress })`.
- Produces: `getWatchlistStatus(item, tvProgress, movieProgress)` and `filterWatchlistItems(items, filter, tvProgress, movieProgress)`.
- Preserves: `getWatchlistProgressLabel(item, tvProgress)`.

- [ ] **Step 1: Replace the loader test with a failing three-collection test**

Inject Watchlist, TV-progress and movie-progress loaders. Assert each is called exactly once for several saved titles and that no network loader exists. A rejected TV or movie progress loader becomes the matching `unavailable/read-error` result while Watchlist items remain available. A rejected Watchlist read still rejects the combined load because the screen cannot render without its primary collection.

- [ ] **Step 2: Add failing status and filter tests**

Create saved fixtures for an unwatched movie, watched movie, TV show without progress, partially watched TV show, and complete TV show. Assert:

```ts
getWatchlistStatus(unwatchedMovie, tvProgress, movieProgress) === 'to-watch'
getWatchlistStatus(watchedMovie, tvProgress, movieProgress) === 'watched'
getWatchlistStatus(partialTv, tvProgress, movieProgress) === 'to-watch'
getWatchlistStatus(completeTv, tvProgress, movieProgress) === 'watched'
```

A TV record counts as complete only when `calculateTvProgress` returns `total > 0` and `watched === total`. A missing record in an available store is `to-watch`. An unavailable store yields `unknown` only for its affected media type. Assert that `All` retains unknown items, `To Watch` includes only `to-watch`, and `Watched` includes only `watched`.

- [ ] **Step 3: Run the focused tracking test and verify failures**

```powershell
npm run test:tracking
```

Expected: FAIL because the three-loader signature and status helpers do not exist.

- [ ] **Step 4: Implement local data composition and classification**

Use the exact filter type:

```ts
export type WatchlistFilter = 'all' | 'to-watch' | 'watched';
export type WatchlistStatus = 'watched' | 'to-watch' | 'unknown';
```

Load all three collections concurrently with `Promise.allSettled`, but throw the Watchlist rejection. Convert rejected progress promises to their typed unavailable results. `getWatchlistStatus` must branch on `mediaType`, find only the relevant local record, and use the existing TV completion calculation. `filterWatchlistItems` must preserve stored Watchlist order.

- [ ] **Step 5: Run focused and static checks**

```powershell
npm run test:tracking
npm run test:movies
npx tsc --noEmit
npm run lint
```

Expected: every command exits 0.

- [ ] **Step 6: Commit local Watchlist status composition**

```powershell
git add -- mobile/src/services/watchlist-progress.ts mobile/tests/watchlist-progress.test.mjs
git commit -m "Classify local Watchlist progress"
```

---

### Task 4: Add Watchlist Badges and Filters

**Files:**
- Modify: `mobile/src/app/(tabs)/watchlist.tsx`

**Interfaces:**
- Consumes: the three-collection loader, `WatchlistFilter`, `WatchlistStatus`, `getWatchlistStatus`, `filterWatchlistItems`, `loadTvProgress`, and `loadMovieProgress`.
- Produces: focus-refreshed All, To Watch and Watched views with honest unknown-state handling.

- [ ] **Step 1: Load both progress collections once on focus**

Replace the two-loader call with:

```ts
loadWatchlistProgressData({
  loadWatchlist,
  loadTvProgress,
  loadMovieProgress,
});
```

Keep both typed progress results in state. Derive each row's status and the filtered list through pure Task 3 helpers. Resetting or changing a filter must never trigger another storage or network read.

- [ ] **Step 2: Render accessible filter controls**

Add an `All`, `To Watch`, `Watched` segmented row below the heading. Each option is a `Pressable` with `accessibilityRole="button"` and `accessibilityState={{ selected: filter === value }}`. Default to `all`; visually distinguish the selected option using the current dark theme.

When a filtered list is empty but the full Watchlist is not, show filter-specific copy such as `No watched titles in your Watchlist.` rather than the first-use Watchlist empty state.

- [ ] **Step 3: Add status presentation without hiding title text**

Pass `status` into each row. For `watched` status:

- movie badge text is `Watched`
- TV badge text is `Completed`
- artwork content is rendered at roughly 55% opacity
- an opaque high-contrast badge sits over the poster
- title, year, progress label and Remove control retain normal opacity
- the route accessibility label includes the status

For `unknown`, render no badge. If either store is unavailable, show `Some watched statuses could not be loaded. Use All to see every saved title.` with an alert role; keep `All` usable.

- [ ] **Step 4: Preserve removal behavior across filters**

After `removeFromWatchlist` resolves, update only the Watchlist items. Do not call either progress removal service. Derive the active filter again so a removed row disappears without another read and re-adding later can restore its status.

- [ ] **Step 5: Run focused and static verification**

```powershell
npm run test:tracking
npm run test:movies
npx tsc --noEmit
npm run lint
```

Expected: every command exits 0 with no FlatList key or hook warnings.

- [ ] **Step 6: Commit the Watchlist interface**

```powershell
git add -- "mobile/src/app/(tabs)/watchlist.tsx"
git commit -m "Show watched titles in Watchlist"
```

---

### Task 5: Add Watched Movies to Home

**Files:**
- Modify: `mobile/src/services/home-data.ts`
- Modify: `mobile/tests/home-data.test.mjs`
- Modify: `mobile/src/components/home-poster-card.tsx`
- Modify: `mobile/src/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `MovieProgressLoadResult`, `loadMovieProgress`, `findWatchedMovie`, existing Home collections and poster cards.
- Produces: Home data with a third independently loaded `movieProgress` collection.
- Produces: `HomePosterCard` optional `statusLabel?: 'Watched' | 'Completed'` presentation.
- Produces: a local Watched Movies rail and watched badges in the Watchlist preview.

- [ ] **Step 1: Write failing three-collection Home tests**

Extend the injected loaders with `loadMovieProgress`. Assert all three loaders are called exactly once. Test each movie-progress outcome:

```ts
movieProgress: { status: 'available', records: watchedMovies }
movieProgress: { status: 'unavailable', reason: 'malformed' }
movieProgress: { status: 'unavailable', reason: 'read-error' }
```

Assert that a rejected movie-progress loader cannot erase available Recently Viewed or Watchlist data. Existing Recently Viewed and Watchlist partial-failure tests must still pass after supplying the third loader.

- [ ] **Step 2: Run Home tests and verify the signature failure**

Run `npm run test:home`.

Expected: FAIL because `HomeData` and `loadHomeData` do not yet include movie progress.

- [ ] **Step 3: Implement the third independent Home collection**

Update the contract:

```ts
export type HomeData = {
  recentlyViewed: RecentlyViewedLoadResult;
  watchlist: HomeCollection<WatchlistItem>;
  movieProgress: MovieProgressLoadResult;
};
```

Add `loadMovieProgress` to the injected loaders and the existing `Promise.allSettled`. Convert a rejection to `{ status: 'unavailable', reason: 'read-error' }`. Do not import fetch, Details, Search or server modules.

- [ ] **Step 4: Add optional poster status presentation**

Change the card interface to:

```ts
export function HomePosterCard({
  item,
  statusLabel,
}: {
  item: HomePosterItem;
  statusLabel?: 'Watched' | 'Completed';
})
```

When a label is present, fade only the artwork content, overlay an opaque badge, and include the label in the link's accessibility text. Keep title and metadata at normal opacity. Poster fallbacks must retain readable contrast.

- [ ] **Step 5: Render the Watched Movies rail and annotate the Watchlist preview**

Pass `loadMovieProgress` into Home loading. Convert watched records to poster items with `id: movieId` and `mediaType: 'Movie'`. Render `Watched Movies` after Recently Viewed, newest first, using the first 20 records and `statusLabel="Watched"`.

For the Watchlist preview, pass `Watched` only when a movie ID exists in the available movie-progress collection. Do not infer or fetch TV completion on Home in this increment. Include movie progress in error and first-use calculations so a person with watched history still sees useful Home content even with an empty Watchlist and Recently Viewed list.

- [ ] **Step 6: Run focused and static verification**

```powershell
npm run test:home
npm run test:movies
npx tsc --noEmit
npm run lint
```

Expected: every command exits 0.

- [ ] **Step 7: Commit the Home collection**

```powershell
git add -- mobile/src/services/home-data.ts mobile/tests/home-data.test.mjs mobile/src/components/home-poster-card.tsx "mobile/src/app/(tabs)/index.tsx"
git commit -m "Add watched movies to Home"
```

---

### Task 6: Automated Verification and Current-Truth Documentation

**Files:**
- Modify: `docs/PROJECT_CONTEXT.md`
- Modify: `docs/ROADMAP.md`
- Modify: `mobile/README.md`

**Interfaces:**
- Consumes: the completed local movie watched flow.
- Produces: accurate architecture, persistence, behavior, limitations and verification instructions.

- [ ] **Step 1: Update documentation without claiming physical verification**

Document `showtime.movie-progress.v1`, independent Watchlist membership, movie Details controls, UK watched dates, Watchlist status filters, the Home Watched Movies rail, one-read-per-collection behavior, rollback, and local-only persistence. Mark implemented automated items complete in the roadmap while leaving the physical iPhone checks open. Keep commands in `mobile/README.md` and feature status/checklists in `docs/ROADMAP.md`.

- [ ] **Step 2: Run the complete automated suite**

```powershell
npm run test:search
npm run test:history
npm run test:watchlist
npm run test:tracking
npm run test:home
npm run test:movies
npx tsc --noEmit
npm run lint
npx expo install --check
```

Expected: every command exits 0.

- [ ] **Step 3: Export iOS and scan the output privately**

```powershell
npx expo export --platform ios --output-dir dist/movie-history-check
```

Expected: the iOS Hermes export succeeds. Confirm `.env.local` and `dist/` are ignored. Read the TMDB token from `.env.local` only inside the verification command, search exported files for the exact token, and report only the match count; expected count is zero. Do not print the token.

Resolve `dist/movie-history-check` to an absolute path, verify it is inside `mobile/dist`, and then remove that exact generated directory with `Remove-Item -LiteralPath ... -Recurse -Force`.

- [ ] **Step 4: Review and commit the automated milestone**

Run `git diff --check`, inspect `git diff --stat`, and confirm no secret or generated output is staged. Commit documentation separately:

```powershell
git add -- docs/PROJECT_CONTEXT.md docs/ROADMAP.md mobile/README.md
git commit -m "Document movie watched status"
```

---

### Task 7: Physical iPhone Verification and Final Status

**Files:**
- Modify: `docs/PROJECT_CONTEXT.md` only if it contains a verification-status statement.
- Modify: `docs/ROADMAP.md`

**Interfaces:**
- Consumes: the automated implementation and local Expo/server startup documented in `mobile/README.md`.
- Produces: a physically verified Phase 6 movie watched increment.

- [ ] **Step 1: Verify Movie Details on the physical iPhone**

With the local Node server on port 3001 and Expo running, open a movie and verify:

1. `Mark as watched` is separate from the Watchlist button.
2. Marking watched shows `Watched DD/MM/YYYY` using the device-local UK date.
3. The movie remains in Watchlist if it was already saved.
4. Marking unwatched clears the watched date without removing it from Watchlist.
5. Marking it watched again restores the current date.
6. A TV detail retains season and episode controls and shows no movie watched button.

- [ ] **Step 2: Verify Watchlist behavior**

Confirm `All`, `To Watch` and `Watched` filter correctly for a watched movie, unwatched movie, partially watched TV show and completed TV show. Check that watched/completed posters are visibly faded, badges are readable, and titles remain clear. Remove a watched movie, reopen it from Search, re-add it, and confirm the badge and filter status return.

- [ ] **Step 3: Verify Home and persistence**

Confirm Watched Movies appears newest first, opens movie details, and uses the faded poster/badge treatment. Confirm watched movies in the Home Watchlist preview also display the badge. Fully close and reopen Expo Go and verify movie history persists. Check a missing-poster movie, Home focus refresh, and unchanged Home, Search, Watchlist and Profile navigation.

- [ ] **Step 4: Record the physical verification**

After the user confirms the checks, mark only the completed physical-device checklist items in `docs/ROADMAP.md` and adjust any verification-status sentence in `docs/PROJECT_CONTEXT.md`. Run:

```powershell
git diff --check
git status --short
git diff --stat
```

- [ ] **Step 5: Commit the verified status**

```powershell
git add -- docs/PROJECT_CONTEXT.md docs/ROADMAP.md
git commit -m "Verify movie watched status on iPhone"
```
