# Home and Recently Viewed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder Home screen with a local dashboard that records and displays recently viewed titles alongside a Watchlist preview.

**Architecture:** Store validated title snapshots in a versioned AsyncStorage collection and record them only after Details succeeds. Home loads Recently Viewed and Watchlist independently on focus, so either section remains usable when the other local read fails, and performs no network request until a user opens a title.

**Tech Stack:** Expo SDK 57, React Native, Expo Router, TypeScript, AsyncStorage, Node test runner

**Spec:** `docs/superpowers/specs/2026-09-13-home-recently-viewed-design.md`

## Global Constraints

- Use the AsyncStorage key `showtime.recently-viewed.v1`.
- Keep at most 20 Recently Viewed records in newest-first order.
- Use TMDB ID plus media type as the title identity.
- Record only successfully displayed Details responses.
- Do not let history read/write failures block Details or the independent Home collection.
- Home must not request TMDB or the local Node server while loading.
- Do not add movie watched status, Continue Watching, upcoming-episode caching, Trending content, recommendations, notifications, accounts, databases or background refresh.
- Preserve Home, Search, Watchlist and Profile navigation.

---

### Task 1: Recently Viewed Rules and Versioned Storage

**Files:**
- Create: `mobile/src/services/recently-viewed-rules.ts`
- Create: `mobile/src/services/recently-viewed-storage.ts`
- Create: `mobile/src/services/recently-viewed.ts`
- Create: `mobile/tests/recently-viewed-rules.test.mjs`

**Interfaces:**
- Produces: `RecentlyViewedItem`, `RecentlyViewedSnapshot`, and `RecentlyViewedLoadResult` types.
- Produces: `parseRecentlyViewed(stored: string | null): RecentlyViewedLoadResult`.
- Produces: `addRecentlyViewedItem(items, snapshot, viewedAt): RecentlyViewedItem[]`.
- Produces: `createRecentlyViewedStorage(storage, now?)` with `load()` and `record(snapshot)`.
- Produces: `loadRecentlyViewed()` and `recordRecentlyViewed(snapshot)` bound to AsyncStorage.

- [ ] **Step 1: Write failing rule tests**

Create tests that assert:

```ts
assert.deepEqual(parseRecentlyViewed(null), { status: 'available', items: [] });
assert.deepEqual(parseRecentlyViewed('[]'), { status: 'available', items: [] });
assert.deepEqual(parseRecentlyViewed('{broken'), { status: 'unavailable', reason: 'malformed' });
assert.deepEqual(parseRecentlyViewed('{}'), { status: 'unavailable', reason: 'malformed' });
```

Use a parsed array containing a valid movie and TV item with the same ID, malformed records, duplicate identities with different timestamps, and unsorted input. Assert that valid records are salvaged, movie/TV identities remain separate, the newest duplicate wins, display strings are trimmed, and output is sorted newest first.

Create 21 valid records, call `addRecentlyViewedItem`, and assert that the newest 20 remain. Re-add an existing identity with changed title/poster fields and assert that it moves to the front with the replacement fields and supplied timestamp.

- [ ] **Step 2: Run the rule tests and verify the missing module failure**

Run:

```powershell
node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/recently-viewed-rules.test.mjs
```

Expected: FAIL because `recently-viewed-rules.ts` does not exist.

- [ ] **Step 3: Implement pure validation and ordering rules**

Implement these types and constants:

```ts
export const RECENTLY_VIEWED_LIMIT = 20;

export type RecentlyViewedSnapshot = {
  id: number;
  mediaType: 'Movie' | 'TV';
  title: string;
  year: string | null;
  posterUrl: string | null;
};

export type RecentlyViewedItem = RecentlyViewedSnapshot & {
  viewedAt: string;
};

export type RecentlyViewedLoadResult =
  | { status: 'available'; items: RecentlyViewedItem[] }
  | { status: 'unavailable'; reason: 'malformed' | 'read-error' };
```

Accept only positive safe IDs, the two media types, non-empty trimmed titles, string-or-null year/poster values, and timestamps for which `new Date(value).toISOString() === value`. Deduplicate by `${mediaType}:${id}`, keep the newest timestamp, sort by descending timestamp then media type then ID, and slice to 20.

- [ ] **Step 4: Run the rule tests and verify they pass**

Run the command from Step 2.

Expected: all Recently Viewed rule tests PASS.

- [ ] **Step 5: Write failing storage tests**

Extend the same test file with an injected storage double and clock:

```ts
const recentStorage = createRecentlyViewedStorage(storage, () => '2026-09-13T12:00:00.000Z');
```

Assert that `load()` uses `showtime.recently-viewed.v1`, converts read exceptions into `{ status: 'unavailable', reason: 'read-error' }`, and does not write during reads. Assert that `record(snapshot)` writes normalized JSON under the versioned key. For malformed stored top-level data, assert that `record` rejects and performs zero writes. For a `setItem` exception, assert that the promise rejects.

- [ ] **Step 6: Implement the injected and bound storage services**

In `recently-viewed-storage.ts`, export the concrete storage contract and factory:

```ts
export const RECENTLY_VIEWED_KEY = 'showtime.recently-viewed.v1';
export class RecentlyViewedUnavailableError extends Error {}

type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

type RecentlyViewedStorage = {
  load: () => Promise<RecentlyViewedLoadResult>;
  record: (snapshot: RecentlyViewedSnapshot) => Promise<RecentlyViewedItem[]>;
};

export function createRecentlyViewedStorage(
  storage: Storage,
  now = () => new Date().toISOString(),
): RecentlyViewedStorage;
```

`record` must load first, reject unavailable data without overwriting it, apply `addRecentlyViewedItem`, write JSON, and return the persisted items. In `recently-viewed.ts`, bind the factory to AsyncStorage and export `loadRecentlyViewed` and `recordRecentlyViewed`.

- [ ] **Step 7: Run static checks**

```powershell
npx tsc --noEmit
npm run lint
```

Expected: both commands exit 0.

- [ ] **Step 8: Commit the storage foundation**

```powershell
git add -- mobile/src/services/recently-viewed-rules.ts mobile/src/services/recently-viewed-storage.ts mobile/src/services/recently-viewed.ts mobile/tests/recently-viewed-rules.test.mjs
git commit -m "Add local recently viewed storage"
```

---

### Task 2: Record Successful Detail Views

**Files:**
- Modify: `mobile/src/components/media-details-screen.tsx`
- Test: `mobile/tests/recently-viewed-rules.test.mjs`

**Interfaces:**
- Consumes: `recordRecentlyViewed(snapshot: RecentlyViewedSnapshot): Promise<RecentlyViewedItem[]>` from Task 1.
- Produces: `createRecentlyViewedSnapshot(details: { id; mediaType; title; releaseDate; posterUrl }): RecentlyViewedSnapshot`.
- Produces: successful movie and TV Details views recorded independently from Watchlist and TV progress.

- [ ] **Step 1: Add a failing snapshot-conversion test**

Add `createRecentlyViewedSnapshot` to the imports and assert:

```ts
assert.deepEqual(createRecentlyViewedSnapshot({
  id: 44006,
  mediaType: 'TV',
  title: 'Chicago Fire',
  releaseDate: '2012-10-10',
  posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
}), {
  id: 44006,
  mediaType: 'TV',
  title: 'Chicago Fire',
  year: '2012',
  posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
});
```

Also assert that a null release date creates `year: null`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run the direct Recently Viewed test command from Task 1.

Expected: FAIL because `createRecentlyViewedSnapshot` is not exported.

- [ ] **Step 3: Implement snapshot conversion and non-blocking recording**

Add this pure structural helper to `recently-viewed-rules.ts` so the rules module does not depend on the Details service:

```ts
export function createRecentlyViewedSnapshot(details: {
  id: number;
  mediaType: 'Movie' | 'TV';
  title: string;
  releaseDate: string | null;
  posterUrl: string | null;
}): RecentlyViewedSnapshot {
  return {
    id: details.id,
    mediaType: details.mediaType,
    title: details.title,
    year: details.releaseDate?.slice(0, 4) ?? null,
    posterUrl: details.posterUrl,
  };
}
```

In `DetailsContent`, add an effect keyed by the displayed title identity and snapshot fields:

```ts
useEffect(() => {
  void recordRecentlyViewed(createRecentlyViewedSnapshot(details)).catch(() => undefined);
}, [details]);
```

If React Compiler lint requires stable primitive dependencies, list `details.id`, `details.mediaType`, `details.title`, `details.releaseDate`, and `details.posterUrl` and construct the snapshot inside the effect. Do not set Details loading/error state from this background persistence attempt.

- [ ] **Step 4: Run focused tests, TypeScript and lint**

```powershell
node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/recently-viewed-rules.test.mjs
npx tsc --noEmit
npm run lint
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit detail recording**

```powershell
git add -- mobile/src/services/recently-viewed-rules.ts mobile/src/components/media-details-screen.tsx mobile/tests/recently-viewed-rules.test.mjs
git commit -m "Remember successfully opened titles"
```

---

### Task 3: Load Independent Home Collections

**Files:**
- Create: `mobile/src/services/home-data.ts`
- Create: `mobile/tests/home-data.test.mjs`
- Modify: `mobile/package.json`

**Interfaces:**
- Consumes: `RecentlyViewedLoadResult`, `WatchlistItem[]`, `loadRecentlyViewed`, and `loadWatchlist`.
- Produces: `loadHomeData(loaders): Promise<HomeData>` where each collection has independent available/unavailable status.

- [ ] **Step 1: Write failing Home data tests**

Define injected loaders and assert that both are called once. When both resolve, expect:

```ts
{
  recentlyViewed: { status: 'available', items: recentItems },
  watchlist: { status: 'available', items: watchlistItems },
}
```

When the Watchlist loader rejects, assert that Recently Viewed remains available and Watchlist becomes `{ status: 'unavailable' }`. When Recently Viewed returns its explicit unavailable state, assert that Watchlist remains available. These tests prove Home has no per-item or server loader.

- [ ] **Step 2: Run the direct Home data test and verify the missing module failure**

Run:

```powershell
node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/home-data.test.mjs
```

Expected: FAIL because `home-data.ts` does not exist.

- [ ] **Step 3: Implement independent collection loading**

Use `Promise.allSettled` so neither local collection can reject the other:

```ts
export type HomeCollection<T> =
  | { status: 'available'; items: T[] }
  | { status: 'unavailable' };

export type HomeData = {
  recentlyViewed: RecentlyViewedLoadResult;
  watchlist: HomeCollection<WatchlistItem>;
};

type HomeLoaders = {
  loadRecentlyViewed: () => Promise<RecentlyViewedLoadResult>;
  loadWatchlist: () => Promise<WatchlistItem[]>;
};

export async function loadHomeData(loaders: HomeLoaders): Promise<HomeData> {
  const [recentResult, watchlistResult] = await Promise.allSettled([
    loaders.loadRecentlyViewed(),
    loaders.loadWatchlist(),
  ]);

  return {
    recentlyViewed: recentResult.status === 'fulfilled'
      ? recentResult.value
      : { status: 'unavailable', reason: 'read-error' },
    watchlist: watchlistResult.status === 'fulfilled'
      ? { status: 'available', items: watchlistResult.value }
      : { status: 'unavailable' },
  };
}
```

Do not import `fetch`, `searchTitles`, `fetchDetails`, or server modules.

- [ ] **Step 4: Add the focused package script and run it**

Add to `mobile/package.json`:

```json
"test:home": "node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/recently-viewed-rules.test.mjs tests/home-data.test.mjs"
```

Run `npm run test:home`.

Expected: all Recently Viewed and Home data tests PASS.

- [ ] **Step 5: Run TypeScript and lint**

```powershell
npx tsc --noEmit
npm run lint
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit Home data composition**

```powershell
git add -- mobile/src/services/home-data.ts mobile/tests/home-data.test.mjs mobile/package.json
git commit -m "Load Home collections independently"
```

---

### Task 4: Build the Local Home Dashboard

**Files:**
- Create: `mobile/src/components/home-poster-card.tsx`
- Modify: `mobile/src/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `loadHomeData`, `loadRecentlyViewed`, `loadWatchlist`, `RecentlyViewedItem`, and `WatchlistItem`.
- Produces: a focus-refreshing Home screen with Search navigation, Recently Viewed, Watchlist preview, empty state, partial errors and retry.

- [ ] **Step 1: Replace the alert-only Home behavior with route-based state**

Use `useFocusEffect` and a memoized `refresh` callback. Initial state is loading. Call:

```ts
const data = await loadHomeData({ loadRecentlyViewed, loadWatchlist });
```

Keep the successful collection visible if the other collection is unavailable. The retry button reruns both local loaders.

- [ ] **Step 2: Add the reusable poster card**

`HomePosterCard` accepts the shared fields present on both item types and creates the existing dynamic route:

```ts
type HomePosterItem = {
  id: number;
  mediaType: 'Movie' | 'TV';
  title: string;
  year: string | null;
  posterUrl: string | null;
};
```

Render a fixed-width pressable card with `expo-image`, a poster fallback, two-line title, and `year · mediaType`. Use an accessibility label such as `Open Chicago Fire, TV`.

- [ ] **Step 3: Build the Home sections**

Use a vertical `ScrollView` with horizontal `ScrollView` rails to avoid nested virtual-list warnings. Render:

- compact `SHOWTIME` heading and tagline
- an Expo Router link styled as a button to `/search`
- Recently Viewed when available and non-empty
- Watchlist preview using the first 10 items and a `See all` link to `/watchlist`
- a first-use card when both available collections are empty
- a small alert and retry action if either collection is unavailable

Do not show duplicate section placeholders when a collection is simply empty.

Use this structure while keeping repeated card mapping inside a small section component:

```tsx
<SafeAreaView style={styles.container}>
  <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.logo}>SHOWTIME</Text>
    <Text style={styles.tagline}>Track what you watch. Discover what&apos;s next.</Text>
    <Link href="/search" asChild>
      <Pressable><Text>Search movies and TV</Text></Pressable>
    </Link>
    {recentItems.length > 0 && <View>
      <Text>Recently Viewed</Text>
      <ScrollView horizontal>
        {recentItems.map((item) => <HomePosterCard key={`${item.mediaType}:${item.id}`} item={item} />)}
      </ScrollView>
    </View>}
    {watchlistPreview.length > 0 && <View>
      <View><Text>Watchlist</Text><Link href="/watchlist">See all</Link></View>
      <ScrollView horizontal>
        {watchlistPreview.map((item) => <HomePosterCard key={`${item.mediaType}:${item.id}`} item={item} />)}
      </ScrollView>
    </View>}
    {showFirstUse && <View><Text>Search for a title to get started.</Text></View>}
    {hasError && <Pressable onPress={() => void refresh()}><Text>Try again</Text></Pressable>}
  </ScrollView>
</SafeAreaView>
```

- [ ] **Step 4: Run focused and static verification**

```powershell
npm run test:home
npx tsc --noEmit
npm run lint
```

Expected: all commands exit 0, with no nested-list or hook-dependency warnings.

- [ ] **Step 5: Commit the Home interface**

```powershell
git add -- mobile/src/components/home-poster-card.tsx "mobile/src/app/(tabs)/index.tsx"
git commit -m "Build the local Home dashboard"
```

---

### Task 5: Documentation and Full Verification

**Files:**
- Modify: `docs/PROJECT_CONTEXT.md`
- Modify: `docs/ROADMAP.md`
- Modify: `mobile/README.md`

**Interfaces:**
- Consumes: the completed Recently Viewed and Home behavior.
- Produces: current-truth project documentation and a physical-device verification checklist.

- [ ] **Step 1: Update documentation**

Document `showtime.recently-viewed.v1`, successful-Details recording, local-only Home loading, the two poster rails, partial failure behavior, and the 20-title limit. Mark only this first Phase 6 increment complete; leave Movie watched, Continue Watching, Upcoming Episodes and Discovery open. Keep startup commands in `mobile/README.md` and feature checklists in `docs/ROADMAP.md`.

- [ ] **Step 2: Run all automated checks**

```powershell
npm run test:search
npm run test:history
npm run test:watchlist
npm run test:tracking
npm run test:home
npx tsc --noEmit
npm run lint
npx expo install --check
```

Expected: every command exits 0.

- [ ] **Step 3: Export the iOS bundle and scan for the private token**

Export to a new ignored `mobile/dist/home-dashboard-check` directory:

```powershell
npx expo export --platform ios --output-dir dist/home-dashboard-check
```

Expected: iOS bundling exits 0. Confirm `.env.local` and `dist/` are ignored, then read the token privately from `.env.local` and assert there are zero exact token matches in exported files without printing the token.

- [ ] **Step 4: Verify on the physical iPhone**

With the local server and Expo running:

1. Open one movie and one TV title from Search.
2. Return Home and confirm both appear newest first under Recently Viewed.
3. Reopen the older item, return Home, and confirm it moves to the front.
4. Add a title to Watchlist and confirm the Home preview refreshes when focused.
5. Open title cards and `See all` and confirm their routes.
6. Verify a missing poster uses the fallback.
7. Fully close and reopen Expo Go and confirm Recently Viewed persists.
8. Confirm Search, Details, Watchlist and Profile still work.

- [ ] **Step 5: Review and commit the verified increment**

Run `git status --short`, `git diff --stat`, `git diff --check`, and inspect the documentation diff. Commit with:

```powershell
git add -- docs/PROJECT_CONTEXT.md docs/ROADMAP.md mobile/README.md
git commit -m "Document the Home dashboard milestone"
```
