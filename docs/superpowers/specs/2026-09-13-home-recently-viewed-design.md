# Home and Recently Viewed Design

## Status

Approved in chat on 13 September 2026 as the first increment of Phase 6 Home, Viewing History and Discovery.

## Goal

Replace the placeholder Home screen with a useful device-local dashboard and create the title metadata foundation required by later Continue Watching and viewing-history work.

Opening a successfully loaded movie or TV detail records that title as recently viewed. This is independent from Watchlist membership and watched progress.

## Scope

This increment includes:

- a versioned device-local Recently Viewed collection
- recording successfully opened movie and TV details
- a functional Home header and Search shortcut
- a horizontal Recently Viewed poster rail
- a horizontal Watchlist preview with a route to the full Watchlist
- loading, empty and partial storage-error states

This increment does not add movie watched status, Continue Watching, upcoming-episode caching, Trending content, recommendations, notifications, accounts, databases or background refresh.

## Local data model

Use the AsyncStorage key `showtime.recently-viewed.v1` with this record:

```ts
type RecentlyViewedItem = {
  id: number;
  mediaType: 'Movie' | 'TV';
  title: string;
  year: string | null;
  posterUrl: string | null;
  viewedAt: string;
};
```

`id` and `mediaType` form the identity because TMDB movie and TV IDs can overlap. `viewedAt` is an ISO timestamp created when the detail response is successfully displayed. A normal timestamp is appropriate for ordering activity; calendar-date-only rules remain limited to TMDB air dates.

The collection keeps at most 20 records. Reopening a title replaces its stored display fields and moves it to the front with a new timestamp. Stored order is newest first, with deterministic identity ordering as a tie-breaker.

## Storage validation and failures

A missing key or valid empty array means no recent titles. Invalid top-level JSON, an invalid top-level type or an AsyncStorage read exception makes Recently Viewed temporarily unavailable and must not be overwritten automatically with an empty collection.

Inside a successfully parsed array, valid records are salvaged and malformed records are ignored. IDs must be positive safe integers, media types must be `Movie` or `TV`, titles must be non-empty, optional poster/year values must have the correct type, and `viewedAt` must be a valid ISO timestamp. Duplicate identities are merged by keeping the record with the newest timestamp.

A write failure never prevents movie or TV details from rendering. It also never presents an unsaved title as persisted. Home displays a small Recently Viewed error while continuing to show any Watchlist data that loaded successfully.

## Details flow

After a detail request succeeds, the details screen creates a `RecentlyViewedItem` from the restricted mobile `MediaDetails` fields and asks the storage service to record it. The write runs independently from Watchlist loading and tracking initialization. It runs once for each displayed title rather than on every render.

Opening a title from Home refreshes its details through the existing local Node server and moves it to the front only after that request succeeds. Failed or invalid detail routes do not enter history.

## Home screen

Home reloads Recently Viewed and Watchlist whenever the tab gains focus so changes made on detail or Watchlist screens appear without restarting the app. Both collections are loaded in parallel from AsyncStorage; Home itself makes no TMDB or local-server request.

The screen contains:

1. A compact Showtime heading and tagline.
2. A clear button that opens Search.
3. A Recently Viewed section showing horizontal poster cards in newest-first order.
4. A Watchlist preview showing horizontal poster cards and a `See all` route to the Watchlist tab.
5. A first-use state that explains how to search and save titles when both collections are empty.

Each poster card displays artwork or a fallback, title, year and media type. Selecting it opens the existing movie or TV detail route. The layout uses the current dark theme and avoids expanding the TV-details interface that the user has chosen to polish later.

If only one collection fails, the other section remains usable. The screen offers a retry action when either local read fails.

## Future use

Continue Watching can later join TV progress to Recently Viewed metadata using `tvId` without changing either storage schema. Movie watched status can use the same title identity and snapshot fields in its own purpose-specific store. Recently Viewed remains an activity list and does not imply that a title was watched.

## Verification

Automated tests cover parsing, malformed top-level data, partial salvage, movie/TV identity collisions, duplicate replacement, newest-first ordering, the 20-item limit, read exceptions and failed writes.

TypeScript, lint, existing automated suites, Expo dependency checks and an iOS export must remain clean. Physical iPhone verification covers recording movie and TV details, newest-first reordering, persistence after restarting Expo Go, Home refresh after navigation, empty and poster-fallback states, Watchlist preview navigation, and unchanged Search, Details, Watchlist and Profile behavior.
