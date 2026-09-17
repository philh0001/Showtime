# Showtime Cinematic UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an original cinematic Showtime brand, editable inline Home search, priority episode information, and a coherent responsive UX across the deployed Expo app.

**Architecture:** Introduce dependency-free semantic design tokens and small shared presentation components, then reuse one search state machine/controller across Home and Search. Keep episode selection as pure tested rules over the existing local schedule cache, while screens compose those units without changing storage or API contracts.

**Tech Stack:** Expo SDK 57, React Native 0.86, React 19, Expo Router, TypeScript 6, Node test runner, `expo-image`, Cloudflare Workers Static Assets.

**Spec:** `docs/superpowers/specs/2026-09-17-cinematic-ux-redesign-design.md`

## Global Constraints

- Use the exact Home placeholder `Search movies or TV shows`.
- Home search submits and renders results in place; it must not navigate to `/search` merely to enter or submit a query.
- Home content order is logo, inline search, Upcoming Episodes, Recently Aired Episodes, Continue Watching, Watchlist, Recently Viewed, then discovery.
- Recently Aired covers 14 days before today inclusive through yesterday, newest first, at most ten episodes.
- Use the existing schedule cache; Home must not add per-show network requests.
- Keep account creation and cross-device sync out of this increment.
- Preserve existing local storage keys, parsing rules, API contracts, TMDB attribution and production Worker URL.
- Use repository-owned vector logo artwork; do not copy the supplied reference.
- Keep controls at least 44 points high and expose focus, selected, busy, disabled and expanded states accessibly.
- Add no runtime dependency unless the existing Expo SDK cannot express a required result.
- Read current Expo SDK 57 documentation before changing Expo Router, Expo Image, icons, app config or export behaviour.

---

## File Structure

### New files

- `mobile/src/constants/design.ts` — dark cinematic colour, spacing, radius and layout tokens with no React Native dependency.
- `mobile/assets/images/showtime-logo.svg` — accessible horizontal gold wordmark.
- `mobile/assets/images/showtime-mark.svg` — compact play/film mark.
- `mobile/src/components/showtime-logo.tsx` — responsive logo presentation.
- `mobile/src/services/search-state.ts` — pure search state transitions.
- `mobile/src/hooks/use-title-search.ts` — request, timeout, cancellation and recent-search orchestration.
- `mobile/src/components/title-search.tsx` — shared Home/full search input, suggestions, states and result rows.
- `mobile/src/components/episode-section.tsx` — shared upcoming/recently-aired rows and states.
- `mobile/src/components/home-poster-rail.tsx` — extracted responsive personal collection.
- `mobile/tests/design-system.test.mjs` — token contrast and brand-asset contracts.
- `mobile/tests/search-state.test.mjs` — pure search transition coverage.
- `mobile/tests/home-ui-contract.test.mjs` — Home ordering and inline-search source contract.

### Modified files

- `mobile/src/constants/theme.ts` — bridge existing theme consumers to semantic tokens.
- `mobile/src/app/_layout.tsx` — branded navigation colours.
- `mobile/src/app/(tabs)/index.tsx` — new Home hierarchy and inline search.
- `mobile/src/app/(tabs)/search.tsx` — reuse the shared search experience.
- `mobile/src/services/tv-schedule-rules.ts` — recently aired selection and reusable tracking helpers.
- `mobile/tests/tv-schedule.test.mjs` — recently aired boundary/order/watched coverage.
- `mobile/src/components/upcoming-section.tsx` — replaced by the shared episode section or reduced to a compatibility wrapper.
- `mobile/src/components/home-poster-card.tsx` — unified cinematic card and progress treatment.
- `mobile/src/components/discovery-section.tsx` — semantic tokens and responsive layout.
- `mobile/src/components/app-tabs.tsx` — native selected-gold semantics.
- `mobile/src/components/app-tabs.web.tsx` — web icons, labels, focus and selected state.
- `mobile/src/components/media-details-screen.tsx` — cinematic hero and action hierarchy.
- `mobile/src/components/detail-extras.tsx` — consistent section/card treatment.
- `mobile/src/components/tv-tracking-section.tsx` — consistent progress/action hierarchy.
- `mobile/src/components/movie-watched-control.tsx` — consistent primary/secondary action states.
- `mobile/src/app/(tabs)/watchlist.tsx` — responsive list/grid and segmented filters.
- `mobile/src/app/(tabs)/profile.tsx` — statistic cards and grouped navigation/settings/about.
- `mobile/src/components/profile-settings.tsx` — grouped semantic controls.
- `mobile/src/app/history.tsx` — shared page/card/state styling.
- `mobile/app.json` — compact brand mark for favicon only after export verification.
- `mobile/README.md`, `docs/ROADMAP.md` — updated UI verification and completion state.

---

### Task 1: Cinematic Design Tokens and Original Logo

**Files:**
- Create: `mobile/src/constants/design.ts`
- Create: `mobile/assets/images/showtime-logo.svg`
- Create: `mobile/assets/images/showtime-mark.svg`
- Create: `mobile/src/components/showtime-logo.tsx`
- Create: `mobile/tests/design-system.test.mjs`
- Modify: `mobile/src/constants/theme.ts`
- Modify: `mobile/src/app/_layout.tsx`

**Interfaces:**
- Produces: `BrandColors`, `Space`, `Radii`, `Layout`, `ControlSize`.
- Produces: `ShowtimeLogo({ compact?: boolean; decorative?: boolean })`.
- Consumes: existing `expo-image` dependency.

- [ ] **Step 1: Write failing design-system tests**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { BrandColors, ControlSize, Layout } from '../src/constants/design.ts';

function luminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((value) => {
    const channel = Number.parseInt(value, 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('brand tokens keep readable text and usable controls', () => {
  assert.ok(contrast(BrandColors.text, BrandColors.background) >= 7);
  assert.ok(contrast(BrandColors.onGold, BrandColors.gold) >= 4.5);
  assert.ok(contrast(BrandColors.textMuted, BrandColors.background) >= 4.5);
  assert.ok(ControlSize.minimum >= 44);
  assert.equal(Layout.maxContentWidth, 1120);
});

test('brand SVGs are original accessible vector assets', async () => {
  for (const name of ['showtime-logo.svg', 'showtime-mark.svg']) {
    const svg = await readFile(path.resolve(import.meta.dirname, '..', 'assets', 'images', name), 'utf8');
    assert.match(svg, /^<svg/);
    assert.match(svg, /<title>Showtime(?: logo)?<\/title>/);
    assert.match(svg, /<linearGradient/);
    assert.doesNotMatch(svg, /<image|data:image|SHOWTIME NETWORKS/i);
  }
});
```

- [ ] **Step 2: Run the test and verify the missing module/assets failure**

Run: `node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/design-system.test.mjs`

Expected: FAIL because `src/constants/design.ts` and the brand SVGs do not exist.

- [ ] **Step 3: Implement dependency-free tokens**

```ts
export const BrandColors = {
  background: '#08090B',
  surface: '#111318',
  surfaceRaised: '#191C22',
  surfaceInteractive: '#20242B',
  border: '#2B3038',
  text: '#F7F2E8',
  textMuted: '#AAA69E',
  gold: '#D7A84A',
  goldBright: '#F0CC7A',
  onGold: '#171005',
  success: '#63D7BA',
  danger: '#FF8A8A',
  focus: '#F0CC7A',
} as const;

export const Space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, section: 36 } as const;
export const Radii = { sm: 8, md: 12, lg: 18, pill: 999 } as const;
export const Layout = { phonePadding: 16, pagePadding: 24, maxContentWidth: 1120 } as const;
export const ControlSize = { minimum: 44, search: 52 } as const;
```

- [ ] **Step 4: Create the two SVGs and logo component**

The horizontal SVG must use a restrained `#F0CC7A` to `#B77924` gradient,
render `SHOWTIME` as vector paths, and integrate a play triangle plus three
small film perforations into the circular `O`. The compact SVG contains only
that mark. Both include the exact title required by the test.

```tsx
import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

export function ShowtimeLogo({ compact = false, decorative = false }: {
  compact?: boolean;
  decorative?: boolean;
}) {
  return <Image
    source={compact
      ? require('@/assets/images/showtime-mark.svg')
      : require('@/assets/images/showtime-logo.svg')}
    style={compact ? styles.mark : styles.logo}
    contentFit="contain"
    accessibilityLabel={decorative ? undefined : 'Showtime'}
    accessible={!decorative}
  />;
}

const styles = StyleSheet.create({
  logo: { width: 220, height: 54 },
  mark: { width: 44, height: 44 },
});
```

- [ ] **Step 5: Bridge the old theme and root navigation to tokens**

Keep `Colors.dark` exported for native tabs but map it to `BrandColors`. Change
root header background/tint/content colours to tokens. Do not add a light mode.

- [ ] **Step 6: Run focused and static verification**

Run:

```powershell
node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/design-system.test.mjs
npx tsc --noEmit
npm run lint
```

Expected: all pass.

- [ ] **Step 7: Commit Task 1**

```powershell
git add mobile/src/constants/design.ts mobile/src/constants/theme.ts mobile/src/components/showtime-logo.tsx mobile/assets/images/showtime-logo.svg mobile/assets/images/showtime-mark.svg mobile/src/app/_layout.tsx mobile/tests/design-system.test.mjs
git commit -m "feat: add cinematic Showtime design system"
```

---

### Task 2: Shared Search State and Search Experience

**Files:**
- Create: `mobile/src/services/search-state.ts`
- Create: `mobile/src/hooks/use-title-search.ts`
- Create: `mobile/src/components/title-search.tsx`
- Create: `mobile/tests/search-state.test.mjs`
- Modify: `mobile/src/app/(tabs)/search.tsx`

**Interfaces:**
- Produces: `SearchState`, `SearchEvent`, `initialSearchState`, `reduceSearchState`.
- Produces: `useTitleSearch(): TitleSearchController`.
- Produces: `TitleSearch({ variant: 'home' | 'full' })`.
- Consumes: `searchTitles`, recent-search storage functions and semantic tokens.

- [ ] **Step 1: Write failing reducer tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { initialSearchState, reduceSearchState } from '../src/services/search-state.ts';

const batman = { id: 'movie-268', title: 'Batman', year: '1989', mediaType: 'Movie', posterUrl: null };

test('query changes clear stale results and submit tracks one request', () => {
  const changed = reduceSearchState(initialSearchState, { type: 'change', query: ' Batman ' });
  assert.deepEqual(changed, { ...initialSearchState, query: ' Batman ' });
  const loading = reduceSearchState(changed, { type: 'submit', requestId: 3, query: 'Batman' });
  assert.equal(loading.status, 'loading');
  assert.equal(loading.requestId, 3);
  assert.equal(loading.query, 'Batman');
});

test('only the active request may publish results or errors', () => {
  const loading = { query: 'Batman', results: [], status: 'loading', requestId: 3, message: null };
  assert.equal(reduceSearchState(loading, { type: 'success', requestId: 2, results: [batman] }), loading);
  assert.deepEqual(
    reduceSearchState(loading, { type: 'success', requestId: 3, results: [batman] }),
    { query: 'Batman', results: [batman], status: 'success', requestId: 3, message: null },
  );
});

test('clear closes inline results and retry preserves the query', () => {
  const error = { query: 'Batman', results: [], status: 'error', requestId: 4, message: 'Search failed.' };
  assert.deepEqual(reduceSearchState(error, { type: 'clear' }), initialSearchState);
  assert.equal(reduceSearchState(error, { type: 'submit', requestId: 5, query: 'Batman' }).query, 'Batman');
});
```

- [ ] **Step 2: Run the reducer test and verify it fails**

Run: `node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/search-state.test.mjs`

Expected: FAIL because `search-state.ts` does not exist.

- [ ] **Step 3: Implement the reducer with exact public types**

```ts
import type { SearchResult } from './search';

export type SearchState = {
  query: string;
  results: SearchResult[];
  status: 'idle' | 'loading' | 'success' | 'error';
  requestId: number;
  message: string | null;
};

export type SearchEvent =
  | { type: 'change'; query: string }
  | { type: 'submit'; requestId: number; query: string }
  | { type: 'success'; requestId: number; results: SearchResult[] }
  | { type: 'error'; requestId: number; message: string }
  | { type: 'clear' };

export const initialSearchState: SearchState = {
  query: '', results: [], status: 'idle', requestId: 0, message: null,
};

export function reduceSearchState(state: SearchState, event: SearchEvent): SearchState {
  if (event.type === 'clear') return initialSearchState;
  if (event.type === 'change') return { ...initialSearchState, query: event.query, requestId: state.requestId };
  if (event.type === 'submit') return { query: event.query, results: [], status: 'loading', requestId: event.requestId, message: null };
  if (event.requestId !== state.requestId) return state;
  if (event.type === 'success') return { ...state, status: 'success', results: event.results, message: null };
  return { ...state, status: 'error', results: [], message: event.message };
}
```

- [ ] **Step 4: Implement `useTitleSearch`**

The hook owns one `AbortController`, increments request IDs, uses a 15-second
timeout, records successful recent searches, exposes suggestions, aborts on
query change/unmount and maps failures to `Could not load results. Check your
connection and try again.`. Its public interface is:

```ts
export type TitleSearchController = SearchState & {
  recentSearches: string[];
  suggestions: string[];
  changeQuery: (query: string) => void;
  submit: (query?: string) => Promise<void>;
  clear: () => void;
  clearHistory: () => void;
};
```

- [ ] **Step 5: Build the shared search UI and replace Search screen duplication**

`TitleSearch` renders the exact placeholder, search icon/text affordance, clear
button, recent suggestions in full mode, compact result rows, loading, error,
retry and empty states. In Home mode it never renders a `/search` Link. In full
mode it includes heading copy and credits supplied by the Search screen.

```tsx
<TextInput
  accessibilityLabel="Search movies or TV shows"
  placeholder="Search movies or TV shows"
  placeholderTextColor={BrandColors.textMuted}
  value={controller.query}
  onChangeText={controller.changeQuery}
  onSubmitEditing={() => void controller.submit()}
  returnKeyType="search"
  maxLength={100}
  autoCorrect={false}
/>
```

- [ ] **Step 6: Run focused and full search verification**

Run:

```powershell
node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/search-state.test.mjs tests/search-history-rules.test.mjs
npx tsc --noEmit
npm run lint
```

Expected: all pass.

- [ ] **Step 7: Commit Task 2**

```powershell
git add mobile/src/services/search-state.ts mobile/src/hooks/use-title-search.ts mobile/src/components/title-search.tsx mobile/src/app/'(tabs)'/search.tsx mobile/tests/search-state.test.mjs
git commit -m "feat: share the Showtime search experience"
```

---

### Task 3: Recently Aired Episode Rules

**Files:**
- Modify: `mobile/src/services/tv-schedule-rules.ts`
- Modify: `mobile/tests/tv-schedule.test.mjs`

**Interfaces:**
- Produces: `RecentlyAiredItem = UpcomingItem & { watched: boolean }`.
- Produces: `getRecentlyAiredEpisodes(schedules, watchlist, progress, todayIso): RecentlyAiredItem[]`.
- Preserves: `getUpcomingEpisodes` signature and behaviour.

- [ ] **Step 1: Add failing boundary, filtering, deduplication and watched tests**

```js
import { getRecentlyAiredEpisodes } from '../src/services/tv-schedule-rules.ts';

test('recently aired returns the prior fourteen days newest first with watched state', () => {
  const records = [schedule(1, { episodes: [
    episode(1, '2026-09-16', 1),
    episode(2, '2026-09-03', 2),
    episode(3, '2026-09-02', 3),
    episode(4, '2026-09-17', 4),
    episode(2, '2026-09-03', 2),
    { ...episode(5, '2026-09-15', 5), seasonNumber: 0 },
  ] }), schedule(2, { episodes: [episode(6, '2026-09-16', 6)] })];
  const progress = { status: 'available', records: [{
    tvId: 1, trackableSeasonNumbers: [1], watchedSeasonNumbers: [],
    episodeProgress: [{
      seasonNumber: 1,
      knownEpisodeNumbers: [1, 2, 3, 4],
      trackableEpisodeNumbers: [1, 2, 3, 4],
      watchedEpisodeNumbers: [2],
    }],
  }] };
  const result = getRecentlyAiredEpisodes(records, [schedule(1)], progress, '2026-09-17');
  assert.deepEqual(result.map((item) => [item.episode.id, item.episode.airDate, item.watched]), [
    [1, '2026-09-16', false],
    [2, '2026-09-03', true],
  ]);
});
```

- [ ] **Step 2: Run the focused test and verify missing export failure**

Run: `node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/tv-schedule.test.mjs`

Expected: FAIL because `getRecentlyAiredEpisodes` is not exported.

- [ ] **Step 3: Refactor shared inclusion/watched helpers and implement the rule**

Use UTC only to subtract whole days from validated ISO date-only values; compare
the resulting `YYYY-MM-DD` strings. Deduplicate with
`${schedule.id}:${seasonNumber}:${episodeNumber}` and sort by descending air
date, then title, show ID, season and episode.

```ts
export type RecentlyAiredItem = UpcomingItem & { watched: boolean };

function addIsoDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getIncludedTvIds(watchlist: WatchlistItem[], progress: ProgressLoadResult) {
  const included = new Set(watchlist.filter((item) => item.mediaType === 'TV').map((item) => item.id));
  if (progress.status === 'unavailable') return included;
  for (const record of progress.records) {
    const hasProgress = calculateTvProgress(record).watched > 0
      || record.episodeProgress.some((item) => record.trackableSeasonNumbers.includes(item.seasonNumber)
        && calculateEpisodeProgress(item).watched > 0);
    if (hasProgress) included.add(record.tvId);
  }
  return included;
}

function isEpisodeWatched(tvId: number, episode: NextEpisode, progress: ProgressLoadResult) {
  if (progress.status === 'unavailable') return false;
  const record = progress.records.find((item) => item.tvId === tvId);
  const detailed = record?.episodeProgress.find((item) => item.seasonNumber === episode.seasonNumber);
  return detailed
    ? detailed.watchedEpisodeNumbers.includes(episode.episodeNumber)
    : record?.watchedSeasonNumbers.includes(episode.seasonNumber) === true;
}

function compareRecentlyAired(left: RecentlyAiredItem, right: RecentlyAiredItem) {
  return right.episode.airDate.localeCompare(left.episode.airDate)
    || left.title.localeCompare(right.title)
    || left.id - right.id
    || left.episode.seasonNumber - right.episode.seasonNumber
    || left.episode.episodeNumber - right.episode.episodeNumber;
}

export function getRecentlyAiredEpisodes(
  schedules: TvSchedule[],
  watchlist: WatchlistItem[],
  progress: ProgressLoadResult,
  todayIso: string,
): RecentlyAiredItem[] {
  const earliest = addIsoDays(todayIso, -14);
  const included = getIncludedTvIds(watchlist, progress);
  const seen = new Set<string>();
  return schedules.flatMap((schedule) => {
    if (!included.has(schedule.id)) return [];
    return schedule.episodes.flatMap((episode) => {
      if (episode.seasonNumber <= 0 || episode.airDate < earliest || episode.airDate >= todayIso) return [];
      const key = `${schedule.id}:${episode.seasonNumber}:${episode.episodeNumber}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ ...schedule, episode, watched: isEpisodeWatched(schedule.id, episode, progress) }];
    });
  }).sort(compareRecentlyAired).slice(0, 10);
}
```

- [ ] **Step 4: Run schedule and full mobile tests**

Run:

```powershell
node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/tv-schedule.test.mjs
npm test
```

Expected: all tests pass and existing Upcoming behaviour is unchanged.

- [ ] **Step 5: Commit Task 3**

```powershell
git add mobile/src/services/tv-schedule-rules.ts mobile/tests/tv-schedule.test.mjs
git commit -m "feat: derive recently aired episodes"
```

---

### Task 4: Rebuild Home Around Search and Episodes

**Files:**
- Create: `mobile/src/components/episode-section.tsx`
- Create: `mobile/src/components/home-poster-rail.tsx`
- Create: `mobile/tests/home-ui-contract.test.mjs`
- Modify: `mobile/src/app/(tabs)/index.tsx`
- Modify: `mobile/src/components/upcoming-section.tsx`
- Modify: `mobile/src/components/home-poster-card.tsx`
- Modify: `mobile/src/components/discovery-section.tsx`

**Interfaces:**
- Consumes: `ShowtimeLogo`, `TitleSearch`, `getUpcomingEpisodes`, `getRecentlyAiredEpisodes`.
- Produces: `EpisodeSection({ title, kind, items, unavailable, onRetry })`.
- Produces: `HomePosterRail` with the existing `PosterRail` prop contract.

- [ ] **Step 1: Write the failing Home source contract**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('Home renders inline search and the approved section order', async () => {
  const source = await readFile(path.resolve(import.meta.dirname, '..', 'src', 'app', '(tabs)', 'index.tsx'), 'utf8');
  assert.match(source, /<ShowtimeLogo/);
  assert.match(source, /<TitleSearch variant="home"/);
  assert.doesNotMatch(source, /href="\/search"[\s\S]{0,300}Search movies and TV/);
  const order = [
    source.indexOf('Upcoming Episodes'),
    source.indexOf('Recently Aired Episodes'),
    source.indexOf('Continue Watching'),
    source.indexOf('Watchlist'),
    source.indexOf('Recently Viewed'),
    source.indexOf('<DiscoverySection'),
  ];
  assert.ok(order.every((position) => position >= 0));
  assert.deepEqual(order, [...order].sort((left, right) => left - right));
  assert.equal(source.includes('Watched Movies'), false);
});
```

- [ ] **Step 2: Run the contract and verify it fails on the old Home**

Run: `node --test tests/home-ui-contract.test.mjs`

Expected: FAIL because Home still has a Search Link and old ordering.

- [ ] **Step 3: Extract reusable poster rail and episode presentation**

Move `PosterRail` unchanged first, then apply tokens and responsive widths.
`EpisodeSection` uses one row component with `kind` to show countdown for
upcoming or `Aired {date}` for recent items, and displays the explicit `Watched`
label when `watched === true`.

```ts
type EpisodeSectionProps = {
  title: 'Upcoming Episodes' | 'Recently Aired Episodes';
  kind: 'upcoming' | 'recent';
  items: (UpcomingItem | RecentlyAiredItem)[];
  unavailable: boolean;
  hasTrackedShows: boolean;
  today: string;
  onRetry: () => Promise<void>;
};
```

- [ ] **Step 4: Recompose Home in the approved order**

Render `ShowtimeLogo`, `<TitleSearch variant="home" />`, then the two episode
sections before any poster collection. Keep successful Home data visible during
refresh, remove the Watched Movies rail, and retain History from Profile.

- [ ] **Step 5: Apply the cinematic card and discovery treatment**

Use raised charcoal cards, unified poster radii, gold progress, warm-white
titles, muted metadata and 44-point actions. On web, use available width rather
than `Platform.OS` to decide rail/grid sizing; keep phone rails horizontally
scrollable.

- [ ] **Step 6: Run Home, schedule and full static verification**

Run:

```powershell
node --test tests/home-ui-contract.test.mjs
node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/tv-schedule.test.mjs tests/home-data.test.mjs tests/continue-watching.test.mjs
npx tsc --noEmit
npm run lint
```

Expected: all pass.

- [ ] **Step 7: Commit Task 4**

```powershell
git add mobile/src/app/'(tabs)'/index.tsx mobile/src/components/episode-section.tsx mobile/src/components/upcoming-section.tsx mobile/src/components/home-poster-rail.tsx mobile/src/components/home-poster-card.tsx mobile/src/components/discovery-section.tsx mobile/tests/home-ui-contract.test.mjs
git commit -m "feat: prioritise search and episodes on Home"
```

---

### Task 5: Navigation and Search UI Consistency

**Files:**
- Modify: `mobile/src/components/app-tabs.tsx`
- Modify: `mobile/src/components/app-tabs.web.tsx`
- Modify: `mobile/src/app/(tabs)/search.tsx`
- Modify: `mobile/src/components/title-search.tsx`

**Interfaces:**
- Consumes: `BrandColors`, `Radii`, `ControlSize`, `TitleSearch`.
- Preserves: four routes and tab labels Home, Search, Watchlist, Profile.

- [ ] **Step 1: Add navigation assertions to the UI contract test**

```js
test('web navigation keeps icons, labels and accessible selected state', async () => {
  const source = await readFile(path.resolve(import.meta.dirname, '..', 'src', 'components', 'app-tabs.web.tsx'), 'utf8');
  for (const label of ['Home', 'Search', 'Watchlist', 'Profile']) assert.match(source, new RegExp(`>${label}<`));
  assert.match(source, /accessibilityState=\{\{ selected: isFocused \}\}/);
  assert.match(source, /tabIcon/);
});
```

- [ ] **Step 2: Run the contract and verify the missing icon assertion**

Run: `node --test tests/home-ui-contract.test.mjs`

Expected: FAIL because the current web tabs are text-only.

- [ ] **Step 3: Restyle native and web tabs**

Keep the existing native SF/Material icon mapping. Set native selected labels
and indicator to gold/raised surface. Add small dependency-free glyphs to web
tabs using text symbols or CSS-drawn shapes already supported by React Native
Web; do not add an icon package. Preserve labels at every width and add visible
focus styles through `tabIndex`, focus state and the gold focus token.

- [ ] **Step 4: Finish the full Search screen around shared `TitleSearch`**

The screen owns the page heading and TMDB credits; `TitleSearch variant="full"`
owns the input, suggestions and results. Ensure the layout starts near the top
on web rather than using the current fixed 96-pixel gap.

- [ ] **Step 5: Verify and commit Task 5**

Run:

```powershell
node --test tests/home-ui-contract.test.mjs
npx tsc --noEmit
npm run lint
```

Then:

```powershell
git add mobile/src/components/app-tabs.tsx mobile/src/components/app-tabs.web.tsx mobile/src/app/'(tabs)'/search.tsx mobile/src/components/title-search.tsx mobile/tests/home-ui-contract.test.mjs
git commit -m "feat: refine Showtime navigation and search UI"
```

---

### Task 6: Cinematic Details and Tracking Hierarchy

**Files:**
- Modify: `mobile/src/components/media-details-screen.tsx`
- Modify: `mobile/src/components/detail-extras.tsx`
- Modify: `mobile/src/components/tv-tracking-section.tsx`
- Modify: `mobile/src/components/movie-watched-control.tsx`

**Interfaces:**
- Consumes: semantic tokens and existing details/tracking service contracts.
- Preserves: all Watchlist, recently viewed, schedule, movie progress, TV progress and viewing-history writes.

- [ ] **Step 1: Record behavioural invariants before styling**

Add assertions to the existing movie/TV progress tests only if an extraction is
needed. Required invariants are: successful details still record recently
viewed/schedule snapshots; Watchlist add/remove remains media-type safe; movie
watched and episode/season actions still record history; failed optional extras
do not fail main details.

Run:

```powershell
node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/detail-extras.test.mjs tests/movie-progress-rules.test.mjs tests/tv-progress-rules.test.mjs tests/viewing-activity.test.mjs
```

Expected: baseline PASS before visual edits.

- [ ] **Step 2: Build the cinematic hero without changing data flow**

Keep backdrop first, add a dark gradient-like overlay using layered translucent
Views, and place poster, title, year/type, rating and primary action in one
responsive summary. On phones stack the summary; at wide widths use poster and
metadata columns. Use the brand logo nowhere inside title details.

- [ ] **Step 3: Clarify actions and secondary sections**

Primary gold action is Add/Remove Watchlist according to state. Watched/progress
controls use selected gold plus text/check indicators. Overview, tracking,
trailers, providers and cast each receive a consistent section header and raised
surface only where grouping improves scanning.

- [ ] **Step 4: Verify all detail behaviour and exports**

Run:

```powershell
npx tsc --noEmit
npm run lint
npm test
npx expo export --platform web --clear
```

Expected: all pass; movie and TV dynamic routes remain in the client bundle.

- [ ] **Step 5: Commit Task 6**

```powershell
git add mobile/src/components/media-details-screen.tsx mobile/src/components/detail-extras.tsx mobile/src/components/tv-tracking-section.tsx mobile/src/components/movie-watched-control.tsx
git commit -m "feat: add cinematic details hierarchy"
```

---

### Task 7: Watchlist, Profile, History and Shared States

**Files:**
- Modify: `mobile/src/app/(tabs)/watchlist.tsx`
- Modify: `mobile/src/app/(tabs)/profile.tsx`
- Modify: `mobile/src/components/profile-settings.tsx`
- Modify: `mobile/src/app/history.tsx`

**Interfaces:**
- Consumes: semantic tokens and existing load/update functions.
- Preserves: Watchlist filters/removal, statistics, settings, history filters and detail links.

- [ ] **Step 1: Run behavioural baselines before presentation changes**

Run:

```powershell
node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/watchlist-rules.test.mjs tests/watchlist-progress.test.mjs tests/settings.test.mjs tests/viewing-activity.test.mjs
```

Expected: baseline PASS.

- [ ] **Step 2: Rebuild Watchlist presentation**

Keep the three filters as a labelled segmented control. Use compact rows below
600 pixels and a two-to-four-column poster grid above it. Every item keeps title,
year/type, progress/status and a separate labelled Remove action. Do not nest
Remove inside the detail Link.

- [ ] **Step 3: Rebuild Profile and Settings grouping**

Render statistics in a responsive two-column card grid, then separate History,
Settings and About with section headings. Keep the exact statement that viewing
data is saved on this device. Do not add a disabled account button in this phase.

- [ ] **Step 4: Align History and all screen states**

Use the same page width, title scale, segmented filters, rows, empty surfaces,
error copy and retry buttons. Keep previous successful content visible when a
refresh fails and do not use colour as the only status.

- [ ] **Step 5: Verify and commit Task 7**

Run:

```powershell
npx tsc --noEmit
npm run lint
npm test
```

Then:

```powershell
git add mobile/src/app/'(tabs)'/watchlist.tsx mobile/src/app/'(tabs)'/profile.tsx mobile/src/components/profile-settings.tsx mobile/src/app/history.tsx
git commit -m "feat: polish personal Showtime screens"
```

---

### Task 8: Brand Integration, Responsive QA and Production Deployment

**Files:**
- Modify: `mobile/app.json`
- Modify: `mobile/README.md`
- Modify: `docs/ROADMAP.md`
- Create: `docs/verification/2026-09-17-cinematic-ux-redesign.md`
- Regenerate ignored output: `mobile/dist/`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified production bundle and redeployed `showtime-web` Worker.
- Preserves: API Worker deployment and exact CORS origin.

- [ ] **Step 1: Integrate the compact mark into web metadata**

Convert the compact SVG deterministically with the already-installed transitive
`sharp` package, inspect the result, and update only `expo.web.favicon`. Do not
replace native icons until physical-device review confirms the crop and safe
area.

```powershell
node -e "require('sharp')('assets/images/showtime-mark.svg').resize(512,512,{fit:'contain'}).png().toFile('assets/images/favicon.png')"
```

- [ ] **Step 2: Run the full local release gate**

Run from `mobile/`:

```powershell
npm run lint
npx tsc --noEmit
npm test
npx expo install --check
npm run web:export:production
npm run worker:release-check
```

Expected: lint and TypeScript pass; all mobile/server and Worker tests pass;
Expo dependencies match SDK 57; production export, bundle, audit gate and secret
scan pass.

- [ ] **Step 3: Inspect the production bundle contracts**

Run:

```powershell
rg -l --fixed-strings "https://showtime-api.showtime-workers.workers.dev" dist
rg -n "TMDB_READ_ACCESS_TOKEN|TMDB_API_KEY|Bearer eyJ|api_key=|localhost:3001" dist
Push-Location ../worker
npx wrangler deploy --config ../mobile/wrangler.jsonc --dry-run
Pop-Location
```

Expected: API URL appears in the web JavaScript; the credential/localhost scan
returns no matches; Wrangler reads the complete asset set and exits dry-run 0.

- [ ] **Step 4: Perform responsive and interaction QA**

Serve `mobile/dist` locally and inspect at 390x844, 768x1024 and 1440x1000.
Verify keyboard-only traversal, visible focus, Home inline search without URL
change, result-to-details navigation, direct `/movie/550` reload, section order,
episode empty/error/populated states, long titles, Watchlist filters/removal,
tracking controls, Profile groups and no horizontal page overflow. Capture final
Home and details screenshots in `docs/screenshots/` and inspect them at original
resolution.

- [ ] **Step 5: Write verification notes and update roadmap**

Record exact commands/results, viewport findings, screenshots, remaining
physical-iPhone checks and any moderate audit advisories in
`docs/verification/2026-09-17-cinematic-ux-redesign.md`. Mark only completed
roadmap items; keep iPhone Safari and Add to Home Screen unchecked until tested.

- [ ] **Step 6: Commit the verified redesign**

```powershell
git add mobile/app.json mobile/README.md docs/ROADMAP.md docs/verification/2026-09-17-cinematic-ux-redesign.md docs/screenshots
git commit -m "docs: verify cinematic Showtime redesign"
```

- [ ] **Step 7: Request final code review and address findings**

Review the complete diff for regressions, security, responsive UX,
accessibility, generated-bundle secrets and scope compliance. Any fix receives a
failing regression test where behaviour changed, followed by the full affected
gate and a dedicated commit.

- [ ] **Step 8: Deploy and smoke-test the frontend**

From `worker/`:

```powershell
npx wrangler deploy --config ../mobile/wrangler.jsonc
```

Verify:

```powershell
curl.exe -sS -D - -o NUL https://showtime-web.showtime-workers.workers.dev/
curl.exe -sS -D - -o NUL -H "Sec-Fetch-Mode: navigate" https://showtime-web.showtime-workers.workers.dev/movie/550
curl.exe -sS -D - -o NUL -H "Origin: https://showtime-web.showtime-workers.workers.dev" "https://showtime-api.showtime-workers.workers.dev/search?query=Batman"
```

Expected: root and deep link return 200 HTML; API returns 200 JSON with exact
`Access-Control-Allow-Origin` and `Vary: Origin`. Run the same isolated headless
Chrome check used by the Cloudflare release and confirm `/movie/550` renders
`Fight Club` with no content-service error.

- [ ] **Step 9: Push and verify branch synchronization**

```powershell
git push origin feature/cloudflare-api
git status --short --branch
git log -1 --oneline --decorate
```

Expected: local and origin both point to the final redesign commit; only the
intentionally untracked `.vscode/` remains.
