# Phase 7 UI and Design Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Showtime automatic light/dark themes and a compact responsive interface across Home, Details, Watchlist and Profile without changing stored data or network behavior.

**Architecture:** Extend the existing theme hook with semantic colour and layout tokens, then migrate shared navigation and screens in vertical slices. Responsive composition is driven by available width; interaction-state changes are kept in focused components and covered by rules tests where they add behavior.

**Tech Stack:** React Native 0.86, Expo SDK 57, Expo Router, TypeScript, Node test runner

**Spec:** `docs/superpowers/specs/2026-09-14-phase-7-ui-polish-design.md`

## Global Constraints

- Follow the device light/dark setting; do not add a manual selector.
- Preserve current storage, networking and navigation semantics.
- Add no runtime dependency, account, hosted service or data-model change.
- Do not mark physical-iPhone verification complete without performing it.
- Keep interactive targets at least 44 points and expose relevant accessibility states.

---

### Task 1: Semantic Theme and Layout Foundations

**Files:**
- Modify: `mobile/src/constants/theme.ts`
- Modify: `mobile/src/hooks/use-theme.ts`
- Modify: `mobile/src/hooks/use-color-scheme.web.ts`
- Modify: `mobile/src/app/_layout.tsx`
- Modify: `mobile/src/components/app-tabs.tsx`
- Modify: `mobile/src/components/app-tabs.web.tsx`

**Interfaces:**
- Produces: `useTheme()` returning semantic colour tokens; shared `Layout`, `Radii` and breakpoint constants.
- Consumes: React Native `useColorScheme` and Expo Router themes.

- [ ] **Step 1: Add semantic theme tokens**

Define light and dark values for `background`, `surface`, `surfaceMuted`, `text`, `textSecondary`, `border`, `accent`, `onAccent`, `danger`, `overlay` and `pressed`. Add shared page padding, content-width and radius constants.

- [ ] **Step 2: Enable the real web colour scheme**

Replace the fixed light return in `use-color-scheme.web.ts` with React Native's `useColorScheme` export so CSS/browser preferences drive the theme.

- [ ] **Step 3: Theme navigation**

Build the Expo Router theme and header colours from `useTheme()`. Migrate native and web tab backgrounds, borders, labels and selection states to semantic tokens.

- [ ] **Step 4: Verify the foundation**

Run `npm run lint` and `npx tsc --noEmit` from `mobile`. Expected: exit 0.

- [ ] **Step 5: Commit**

```sh
git add mobile/src/constants/theme.ts mobile/src/hooks/use-theme.ts mobile/src/hooks/use-color-scheme.web.ts mobile/src/app/_layout.tsx mobile/src/components/app-tabs.tsx mobile/src/components/app-tabs.web.tsx
git commit -m "feat: add adaptive Showtime themes"
```

### Task 2: Responsive Home Composition

**Files:**
- Modify: `mobile/src/app/(tabs)/index.tsx`
- Modify: `mobile/src/components/home-poster-card.tsx`
- Modify: `mobile/src/components/upcoming-section.tsx`
- Modify: `mobile/src/components/discovery-section.tsx`
- Test: `mobile/tests/home-layout-rules.test.mjs`
- Create: `mobile/src/services/home-layout-rules.ts`

**Interfaces:**
- Produces: `getHomeLayout(width, counts)` returning content width, column count and sparse/list presentation decisions.
- Consumes: semantic tokens from Task 1 and current Home collections unchanged.

- [ ] **Step 1: Write failing responsive-rule tests**

Cover one column on phone, two module columns at tablet/desktop widths, compact treatment for one or two personal items, and rails for three or more items.

- [ ] **Step 2: Run the focused test and confirm failure**

Run `node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/home-layout-rules.test.mjs`. Expected: failure because `home-layout-rules.ts` does not exist.

- [ ] **Step 3: Implement the layout rules**

Add pure width/count helpers with named breakpoints and deterministic outputs; do not read platform globals in the rules module.

- [ ] **Step 4: Apply responsive Home layout**

Use `useWindowDimensions`, centred content width, balanced personal modules, sparse rows and populated rails. Theme Home, poster cards, Upcoming and Discovery. Keep data loading, ordering and retry behavior unchanged.

- [ ] **Step 5: Verify Home**

Run the focused test, `npm test`, `npm run lint` and `npx tsc --noEmit`. Expected: all exit 0.

- [ ] **Step 6: Commit**

```sh
git add mobile/src/app/'(tabs)'/index.tsx mobile/src/components/home-poster-card.tsx mobile/src/components/upcoming-section.tsx mobile/src/components/discovery-section.tsx mobile/src/services/home-layout-rules.ts mobile/tests/home-layout-rules.test.mjs
git commit -m "feat: make Home responsive and theme aware"
```

### Task 3: Simplified TV Tracking and Responsive Details

**Files:**
- Modify: `mobile/src/components/media-details-screen.tsx`
- Modify: `mobile/src/components/tv-tracking-section.tsx`
- Modify: `mobile/src/components/detail-extras.tsx`
- Modify: `mobile/src/components/movie-watched-control.tsx`
- Create: `mobile/src/services/tv-tracking-layout-rules.ts`
- Test: `mobile/tests/tv-tracking-layout-rules.test.mjs`

**Interfaces:**
- Produces: `getInitialEpisodeExpansion(episodeCount)` and `getDetailsLayout(width)` pure presentation rules.
- Consumes: current TV progress actions and semantic tokens; no storage changes.

- [ ] **Step 1: Write failing presentation-rule tests**

Verify long episode lists start collapsed, short lists remain visible, toggling is available only when there are episodes, phone details stay stacked and wide details use two columns.

- [ ] **Step 2: Run the focused test and confirm failure**

Run `node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/tv-tracking-layout-rules.test.mjs`. Expected: missing-module failure.

- [ ] **Step 3: Implement pure presentation rules**

Return explicit booleans/layout modes from episode count and available width.

- [ ] **Step 4: Simplify tracking UI**

Group latest-season summary, progress and bulk action; add an accessible expanded-state episode control; render older seasons as compact rows; keep Specials visible and untracked. Theme all states.

- [ ] **Step 5: Make details responsive**

Use stacked phone composition and a wide summary/content split while preserving details order, Watchlist actions, tracking, extras and credits.

- [ ] **Step 6: Verify Details and tracking**

Run the focused test, `npm test`, `npm run lint` and `npx tsc --noEmit`. Expected: all exit 0.

- [ ] **Step 7: Commit**

```sh
git add mobile/src/components/media-details-screen.tsx mobile/src/components/tv-tracking-section.tsx mobile/src/components/detail-extras.tsx mobile/src/components/movie-watched-control.tsx mobile/src/services/tv-tracking-layout-rules.ts mobile/tests/tv-tracking-layout-rules.test.mjs
git commit -m "feat: simplify responsive title tracking"
```

### Task 4: Responsive Watchlist and Grouped Profile

**Files:**
- Modify: `mobile/src/app/(tabs)/watchlist.tsx`
- Modify: `mobile/src/app/(tabs)/profile.tsx`
- Modify: `mobile/src/components/profile-settings.tsx`
- Create: `mobile/src/services/collection-layout-rules.ts`
- Test: `mobile/tests/collection-layout-rules.test.mjs`

**Interfaces:**
- Produces: `getWatchlistColumns(width)` and `getProfileColumns(width)`.
- Consumes: existing Watchlist filters/actions, viewing stats and semantic tokens.

- [ ] **Step 1: Write failing collection-layout tests**

Verify narrow Watchlist/Profile use one column, medium Profile uses two, and wider Watchlist uses increasing bounded column counts.

- [ ] **Step 2: Run the focused test and confirm failure**

Run `node --no-warnings=ExperimentalWarning --experimental-strip-types --test tests/collection-layout-rules.test.mjs`. Expected: missing-module failure.

- [ ] **Step 3: Implement width rules**

Add deterministic column helpers with bounded results and no React dependencies.

- [ ] **Step 4: Apply Watchlist and Profile layouts**

Use responsive cards/grid when width permits, retain a narrow compact treatment, keep filters and removal accessible, and group Profile statistics, navigation, Settings and About. Theme all states.

- [ ] **Step 5: Verify collections**

Run the focused test, `npm test`, `npm run lint` and `npx tsc --noEmit`. Expected: all exit 0.

- [ ] **Step 6: Commit**

```sh
git add mobile/src/app/'(tabs)'/watchlist.tsx mobile/src/app/'(tabs)'/profile.tsx mobile/src/components/profile-settings.tsx mobile/src/services/collection-layout-rules.ts mobile/tests/collection-layout-rules.test.mjs
git commit -m "feat: polish Watchlist and Profile layouts"
```

### Task 5: Consistency, Accessibility and Documentation

**Files:**
- Modify: remaining themed files under `mobile/src/app` and `mobile/src/components`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/PROJECT_CONTEXT.md`
- Modify: `mobile/README.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: consistently themed screens and an accurate verification record.

- [ ] **Step 1: Scan for hard-coded palette colours**

Run `rg -n "#[0-9A-Fa-f]{6}" mobile/src/app mobile/src/components`. Classify required image/brand values separately; migrate UI palette values to semantic tokens.

- [ ] **Step 2: Review interaction semantics**

Check touch targets, headings, selected/expanded/busy/disabled states, text wrapping and web keyboard focus across all changed screens.

- [ ] **Step 3: Run full verification**

From `mobile`, run `npm test`, `npm run lint`, `npx tsc --noEmit`, `npx expo install --check`, `npx expo export --platform web --output-dir dist-web-phase7` and `npx expo export --platform ios --output-dir dist-ios-phase7 --max-workers 1`. Expected: all exit 0.

- [ ] **Step 4: Perform browser QA**

Check light and dark modes at approximately 390, 768 and 1280 pixels with sparse and populated data, keyboard navigation, empty states and API/storage errors. Record exact coverage and screenshots.

- [ ] **Step 5: Update current documentation**

Mark only automated/browser-verified Phase 7 items complete. Keep expanded Phase 6/7 physical-iPhone verification open and document any manual checks still required.

- [ ] **Step 6: Commit**

```sh
git add mobile/src docs/ROADMAP.md docs/PROJECT_CONTEXT.md mobile/README.md
git commit -m "docs: record Phase 7 UI verification"
```
