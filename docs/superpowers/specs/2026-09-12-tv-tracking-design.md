# TV Tracking and Air-Date Countdown Design

## Goal

Add a small first version of TV tracking that lets someone mark regular seasons
as watched, see season progress, and see when TMDB says the next episode will air.

## Scope

- Each regular season can be marked watched or unwatched independently.
- Specials (`seasonNumber === 0`) remain visible but are excluded from tracking.
- Progress is displayed as `2 of 5 seasons watched`.
- A known future episode is displayed as season number, episode number, optional
  title, air date, and a calendar countdown.
- Season progress persists locally on the device with AsyncStorage.
- Movies and the existing Watchlist behavior remain unchanged.
- Episode-level watched tracking and exact broadcast times are outside this
  version.

## Air-date behavior

TMDB TV details supply `next_episode_to_air.air_date` as a `YYYY-MM-DD` calendar
date, without an exact airtime or timezone. Showtime will therefore use date-only
language:

- More than one day away: `Airs in N days`
- One day away: `Airs tomorrow`
- Same calendar date: `Airs today`
- Missing next episode: `No upcoming episode announced`

The calculation will compare date-only values rather than treating the date as a
local or UTC broadcast timestamp. The UI will never show hours or minutes from
TMDB's date-only value.

The countdown appears on the TV detail screen, where the existing details request
retrieves fresh data. The Watchlist will show locally stored season progress but
will not make one network request per saved show merely to refresh countdowns.

## Data contracts

The computer-only details server will map TMDB's `next_episode_to_air` into this
safe response shape for TV titles:

```ts
type NextEpisode = {
  id: number;
  name: string | null;
  seasonNumber: number;
  episodeNumber: number;
  airDate: string;
};
```

Movies and TV shows without valid upcoming data return `nextEpisode: null`.
Only these display fields cross from the TMDB response into the mobile app.

Local progress uses the TMDB TV ID and watched season numbers:

```ts
type TvProgress = {
  tvId: number;
  watchedSeasonNumbers: number[];
};
```

The storage parser will reject malformed IDs and season numbers, remove duplicate
records, and ignore season zero. Removing a show from the Watchlist will not erase
its viewing progress.

## Components and data flow

1. The existing `/details/tv/:id` server route requests fresh TMDB TV details and
   includes the validated next episode in its response.
2. The mobile details service validates the new nullable next-episode field.
3. Pure tracking rules toggle season numbers and calculate watched/total progress.
4. A small AsyncStorage adapter loads and saves progress under a new Showtime key.
5. The TV detail screen loads local progress after its details arrive, renders the
   next-air-date card, and adds watched controls to regular season rows.
6. The Watchlist screen loads local progress on focus and shows the progress text
   for saved TV titles. Movie rows do not show season progress.

No global state library is needed. Both screens reload the small local data set at
the points where it can have changed.

## Progress rules

- The denominator includes regular seasons that have begun airing.
- A regular season with a known future air date is excluded until that date.
- A regular season with no air date remains included because it may be an older
  season with incomplete metadata.
- Watched values for seasons no longer returned by TMDB remain stored but do not
  count toward the displayed total.

## Error handling

- Invalid next-episode data becomes `null` rather than breaking TV details.
- Existing safe server errors and credential boundaries remain unchanged.
- A storage read failure shows tracking as unavailable while leaving TV details
  usable.
- A failed watched/unwatched update keeps the previous state and shows a local
  retry message.
- A missing or past next episode never produces a negative countdown.

## Verification

- Server tests cover valid, missing, and malformed next-episode responses.
- Pure unit tests cover date countdown labels, tracking toggles, validation,
  specials exclusion, and progress totals.
- Existing search, details, history, and Watchlist tests continue to pass.
- Lint, TypeScript, Expo dependency checks, and an iOS export pass.
- Physical iPhone verification covers season toggles, progress on TV details and
  Watchlist, persistence after restarting Expo Go, upcoming/missing episode copy,
  and unchanged movie behavior.
