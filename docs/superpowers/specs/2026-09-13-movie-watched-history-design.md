# Movie Watched Status and History Design

## Status

Approved in chat on 13 September 2026 as the next increment of Phase 6 Home, Viewing History and Discovery.

## Goal

Let someone record that they have watched a movie, find watched movies again, and distinguish watched titles from titles still waiting in the Watchlist.

Movie watched status is independent from Watchlist membership. Marking a movie watched never removes it from the Watchlist, and removing or re-adding it never deletes or resets its watched record.

## Scope

This increment includes:

- a versioned device-local movie watched collection
- watched and unwatched controls on movie details
- a clear watched treatment on Watchlist movie cards
- Watchlist filters for all, to-watch and watched/completed titles
- a Watched Movies rail on Home, ordered by the most recent watched date
- storage validation, partial recovery and write rollback

It does not add movie ratings, favourites, notes, repeat-viewing events, cloud sync, accounts, a database, notifications, recommendations or any new TMDB requests. TV progress retains its Phase 5 model and controls.

## Local data model

Use the AsyncStorage key `showtime.movie-progress.v1` with one current record per movie:

```ts
type WatchedMovie = {
  movieId: number;
  title: string;
  year: string | null;
  posterUrl: string | null;
  watchedAt: string;
};
```

`movieId` is a positive TMDB movie ID. The title, year and poster URL are a local display snapshot so Home and Watchlist never need a details request to render watched state. `watchedAt` is an ISO timestamp created when the movie is marked watched. A timestamp is appropriate for ordering user activity; TMDB air-date-only rules do not apply to it.

The collection retains one record for every movie marked watched, with no small rolling limit that could silently discard older history. Records persist newest first, using `movieId` as a deterministic tie-breaker. Home displays a preview of the newest 20 records.

Marking an unwatched movie as watched adds its record. Marking it unwatched removes that current record. Marking it watched again after clearing it creates a new `watchedAt` value and returns it to the front. This is a current watched collection rather than a repeat-viewing event log; multiple viewings can be introduced later without changing this increment's meaning.

## Storage validation and failures

A missing key or valid empty array means no movies have been marked watched. Invalid top-level JSON, an invalid top-level type or an AsyncStorage read exception makes movie progress temporarily unavailable and must not be overwritten automatically with an empty collection.

Inside a successfully parsed array, valid records are salvaged and malformed records are ignored. Movie IDs must be positive safe integers, titles must be non-empty strings, optional poster and year values must have the correct type, and `watchedAt` must be a valid ISO timestamp. Duplicate movie IDs are merged by keeping the valid record with the newest timestamp. The normalized collection is sorted deterministically before persistence.

When a watched or unwatched write fails, the screen restores its previous state and shows a small retry message. If the initial read is unavailable, the watched control stays unavailable until a successful retry because writing from an unknown state could erase valid records. Details, Watchlist and the other Home sections remain usable.

## Movie details flow

Movie details load watched state separately from Watchlist membership. The existing Watchlist button remains responsible only for saving or removing the movie from the Watchlist. A second control marks the movie watched or unwatched.

The screen displays the watched date in device-local UK format, such as `Watched 13/09/2026`. The stored timestamp remains an ISO instant so records sort correctly. Movie detail loading and Recently Viewed recording continue even if movie-progress storage is unavailable.

TV details do not show the movie watched control and retain their current season and episode tracking behavior.

## Watchlist behavior

Watchlist reads the Watchlist, TV progress and movie progress once each from AsyncStorage. It makes no TMDB or local-server requests and never loads progress per title.

A watched movie uses a slightly faded poster with a high-contrast `Watched` badge. Its title and supporting text remain at normal opacity for readability. A TV show uses the equivalent `Completed` treatment only when the existing local TV-progress calculation reports at least one current trackable season and all current trackable seasons complete.

The Watchlist provides three filters:

- `All` shows every saved movie and TV show and remains the default.
- `To Watch` shows movies without a watched record and TV shows that are not locally complete.
- `Watched` shows watched movies and locally complete TV shows.

If a required progress store is temporarily unavailable, affected items remain visible in `All` without a watched/completed treatment. They are omitted from the status filters, and the screen explains that some statuses could not be loaded. A valid available store with no matching record means the title is not watched or complete.

Removing a title from Watchlist changes only Watchlist storage. Re-adding a watched movie restores its badge and filtering status from movie-progress storage, just as re-adding a TV show restores its existing TV progress.

## Home behavior

Home adds a `Watched Movies` horizontal rail ordered by `watchedAt`, newest first. Each card opens the existing movie detail route and uses the same faded poster and `Watched` badge. The rail shows the newest 20 records; the full local collection remains stored.

Home loads Recently Viewed, Watchlist and movie progress independently in parallel. It remains a local-only dashboard and makes no TMDB or local-server request. A movie-progress failure produces a small error for the Watched Movies section while Recently Viewed and Watchlist remain usable.

The existing Watchlist preview can display the watched movie treatment using the already loaded movie-progress collection. Continue Watching and TV activity remain separate later Phase 6 work.

## Components and data flow

Pure movie-progress rules validate, normalize, merge, order, add and remove records without depending on React Native or AsyncStorage. A storage adapter owns the versioned key and converts storage failures into an unavailable result. A small mobile service binds that adapter to AsyncStorage.

Movie Details uses the service to load and update one movie's status. Watchlist combines its saved metadata with one movie-progress read and the existing one TV-progress read. Home's collection loader expands to a third independent local result. Poster-card components receive explicit watched/completed display state rather than reading storage themselves.

This keeps persistence, status calculation and presentation separately testable and avoids introducing global state. Screens refresh on focus so successful changes appear after navigation without a background refresh system.

## Verification

Automated tests cover:

- missing, empty, malformed and invalid top-level storage values
- salvage of valid records from partially malformed arrays
- invalid IDs, titles, optional fields and timestamps
- duplicate movie IDs keeping the newest valid record
- deterministic newest-first persistence
- marking watched, marking unwatched and marking watched again
- read exceptions and write-failure rollback
- Watchlist classification for unwatched movies, watched movies, incomplete TV, complete TV and unavailable progress
- Watchlist removal and re-add preservation
- Home's three independent local reads and partial failures
- the absence of per-title or Home network requests

TypeScript, lint, the complete automated suite, Expo SDK dependency checks and an iOS export must remain clean. Physical iPhone verification covers movie marking and unmarking, UK watched-date display, faded poster and badge readability, all three Watchlist filters, remove/re-add preservation, Home ordering, persistence after restarting Expo Go, failed-poster fallbacks, unchanged TV tracking, and unchanged Search, Details, Watchlist and Profile navigation.
