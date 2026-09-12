# TV Tracking and Air-Date Countdown Design

## Goal

Add a small first version of TV tracking that lets someone mark regular seasons
as watched, see season progress on TV details and in the Watchlist, and see when
TMDB says the next episode will air.

## Scope

- Each regular season can be marked watched or unwatched independently.
- Specials (`seasonNumber === 0`) remain visible but cannot be tracked and never
  contribute to progress.
- Progress is displayed as `2 of 5 seasons watched`.
- A valid future episode is displayed with its season number, episode number,
  optional title, UK-formatted air date, and calendar countdown.
- Tracking persists locally and remains independent of Watchlist membership.
- Movies and the existing movie Watchlist behavior remain unchanged.
- Episode-level watched tracking, background refresh, databases, authentication,
  and global state libraries are outside this version.

## Air-date behavior

TMDB TV details supply `next_episode_to_air.air_date` as a `YYYY-MM-DD` calendar
date without an exact airtime or timezone. Showtime will use date-only language:

- More than one day away: `Airs in N days`
- One day away: `Airs tomorrow`
- Same calendar date: `Airs today`
- Missing, malformed, or past date: `No upcoming episode announced`

Dates remain in TMDB's ISO `YYYY-MM-DD` form in data contracts and are displayed
in UK `DD/MM/YYYY` form, for example `07/10/2026`. Formatting does not change the
date or imply a UK broadcast time, timezone, or broadcaster-confirmed schedule.

“Today” means the device's current local calendar date. The countdown logic will
split both ISO dates into integer year, month, and day components, validate that
they form real Gregorian dates, and compare calendar-day indexes calculated from
those numeric components. It will not pass TMDB's date-only string to the normal
`Date` parser or apply timezone conversion. This avoids shifting an air date to
the previous or next day.

The server and mobile layers have separate responsibilities. The server returns
`nextEpisode: null` when TMDB's value is missing or malformed. It does not decide
whether a structurally valid air date is past because the server is not the
authority for the device's local calendar date. The mobile details service makes
that final comparison and exposes `nextEpisode: null` to the UI when the date is
past. The UI therefore never displays a negative countdown.

## Server and mobile detail contract

The computer-only details server will map TMDB's `next_episode_to_air` into this
restricted response shape:

```ts
type NextEpisode = {
  id: number;
  name: string | null;
  seasonNumber: number;
  episodeNumber: number;
  airDate: string;
};
```

All numeric identifiers and season/episode numbers must be valid non-negative or
positive integers as appropriate, and `airDate` must be a real ISO calendar date.
The server returns `nextEpisode: null` for movies and for missing or malformed
TMDB next-episode data. A valid candidate crosses into the mobile layer even if
its date may be past; the server performs no clock or past-date comparison.

The mobile details service validates the restricted candidate again and compares
its date with the device-local calendar date. It returns `nextEpisode: null` to
the UI when that valid date is past. Only approved display fields cross either
boundary.

The date utility accepts the current device-local calendar date as an explicit
input. This keeps countdown tests deterministic and makes the device, rather than
a future hosted server timezone, authoritative for “today.”

## Local progress model

Each saved progress record contains both the seasons currently eligible for the
progress total and the seasons the user marked watched:

```ts
type TvProgress = {
  tvId: number;
  trackableSeasonNumbers: number[];
  watchedSeasonNumbers: number[];
};
```

Progress is stored under the versioned AsyncStorage key
`showtime.tv-progress.v1`. A later incompatible model can use a new key and an
explicit migration without guessing which schema produced old data.

Whenever fresh TV details load, the app derives the current trackable regular
season numbers and saves them into that show's progress record. Existing watched
season numbers are retained, including stale values not present in the new TMDB
response. This gives the Watchlist enough local information to calculate both
parts of `2 of 5 seasons watched` without fetching TMDB.

For display, the watched count is the intersection of `watchedSeasonNumbers` and
`trackableSeasonNumbers`; the total is `trackableSeasonNumbers.length`. A watched
season that TMDB no longer returns remains stored for possible future recovery
but does not count in either displayed value.

An older saved TV show may have no progress record until its details are first
opened after this feature ships. Its Watchlist row displays `Open details to load
season progress` instead of `0 of 0`, and it makes no background network request.

## Trackable and currently-airing seasons

- A regular season is any season with `seasonNumber > 0`.
- A regular season with an air date on or before the device's local calendar date
  is trackable.
- A regular season with a known future air date is excluded until that date.
- A regular season with no air date is trackable because it may be an older season
  whose TMDB metadata is incomplete.
- Specials remain visible in TV details but have no watched control.

A season that has started airing may be marked fully watched even if more episodes
are still scheduled. This is an intentional v1 simplification: tracking is at
season level, and TMDB's season summary does not reliably establish that every
episode has finished airing. Episode-level completion can replace this rule in a
future model.

## Persistence validation

Loading `showtime.tv-progress.v1` treats stored JSON as untrusted data:

- A missing key and a valid empty JSON array both mean that no progress exists
  yet; tracking remains available with an empty collection.
- `tvId` must be a positive safe integer.
- Both season arrays must contain only positive safe integers.
- Season zero, negative values, fractions, strings, and unsafe integers are
  ignored.
- Duplicate season numbers are removed from each array.
- Duplicate valid records with the same `tvId` are merged by taking the union of
  their valid `trackableSeasonNumbers` and `watchedSeasonNumbers` values.
- Within a successfully parsed top-level array, malformed individual records are
  ignored while every valid record is salvaged.
- Invalid top-level JSON, a valid non-array top-level value, or an AsyncStorage
  read exception produces an unavailable result rather than an empty collection.

The storage loader represents the distinction explicitly:

```ts
type ProgressLoadResult =
  | { status: 'available'; records: TvProgress[] }
  | { status: 'unavailable'; reason: 'malformed' | 'read-error' };
```

An unavailable result disables tracking controls and shows a small local error
message. It is never automatically written back as an empty array, so unreadable
data is not silently destroyed. The artwork, metadata, seasons, and Back
navigation on the TV detail screen remain usable.

## Components and data flow

1. `/details/tv/:id` requests fresh TMDB TV details, validates only the response
   shape and real ISO calendar date, and returns a restricted next-episode
   candidate with the existing season summaries. It does not decide whether the
   date is past.
2. The mobile details service performs the final date-only comparison against the
   device's local calendar date and exposes a past candidate as
   `nextEpisode: null`.
3. Pure date utilities format ISO dates as `DD/MM/YYYY` and produce countdown
   labels without timestamp parsing.
4. Pure progress rules validate storage, derive trackable seasons, toggle watched
   values, and calculate the watched/total intersection.
5. An AsyncStorage adapter reads and writes `showtime.tv-progress.v1`.
6. TV details synchronize the fresh trackable season numbers, load watched state,
   show the next-air-date card, and render watched controls for regular seasons.
7. Watchlist loads the complete progress collection once when focused and combines
   it with saved items locally. Movie rows do not show season progress.

There is no per-item Watchlist request and no background refresh. Opening a TV
detail screen is the only action in this version that refreshes that show's TMDB
schedule and current season list.

## Watchlist independence

Watchlist storage and TV-progress storage use separate keys and services.
Removing a show from the Watchlist never calls the progress deletion path.
Re-adding the same TMDB TV ID reads and displays its previously stored progress.

## Write-failure behavior

When a watched control is pressed, the screen keeps a snapshot of the previous
progress, applies the new state, and disables further presses while saving. If
AsyncStorage succeeds, the new state remains. If it fails, the screen restores
the snapshot and shows a small retry/error message so the UI never claims an
unpersisted change. Other TV detail content remains interactive.

If synchronizing newly derived `trackableSeasonNumbers` fails, the app retains
the previously stored record, shows tracking as temporarily unavailable on that
detail screen, and does not erase watched values.

## Verification

Automated verification will cover:

- Server mapping of a valid next episode with only approved display fields.
- Server handling of missing and malformed next-episode data as `null`.
- A server test confirming that a structurally valid past-dated candidate is
  preserved because the server performs no past-date decision.
- Mobile handling of that past candidate as `nextEpisode: null` using the supplied
  device-local calendar date.
- Countdown labels for today, tomorrow, multiple days away, and no upcoming
  episode using true date-only arithmetic.
- UK `DD/MM/YYYY` output, including dates near month and year boundaries.
- Trackable-season derivation, including currently-airing seasons and known future
  seasons.
- Specials remaining visible while excluded from controls, watched values, and
  totals.
- Missing-key and valid-empty-array storage producing an available empty result.
- Invalid top-level JSON, non-array values, and read exceptions producing an
  unavailable result with no automatic empty-list write-back.
- Valid records being salvaged from a parsed array while malformed records are
  ignored.
- Duplicate valid TV records being merged by union, plus duplicate and malformed
  stored TV IDs and season values.
- Stale watched seasons remaining stored but excluded from displayed progress.
- A simulated AsyncStorage write failure restoring the previous UI/domain state.
- Removing and re-adding a Watchlist item preserving its separate progress record.
- Watchlist progress loading one local progress collection for multiple saved TV
  shows, with zero per-item network calls.
- Existing movie detail and movie Watchlist behavior remaining unchanged.
- Existing search, details, history, and Watchlist tests continuing to pass.
- Lint, TypeScript, Expo SDK 57 dependency checks, and an iOS export.

Physical iPhone verification will cover:

- Marking currently-airing and completed regular seasons watched and unwatched.
- Progress updating on TV details and in the Watchlist.
- Specials remaining visible without a watched control.
- Persistence after fully closing and reopening Expo Go.
- Removing and re-adding a Watchlist TV show restoring its progress.
- Upcoming and missing episode copy with UK date formatting.
- Movies continuing to open, save, and remove without TV tracking UI.
