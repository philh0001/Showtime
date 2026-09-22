# Latest-Season Episode Tracking Design

## Status

Approved on 13 September 2026 as an extension of Phase 5 TV Tracking and Air-Date Countdown.

## Goal

Show useful air-date information when TMDB omits `next_episode_to_air`, and let people mark individual episodes watched in the newest regular season without expanding into all-season episode tracking.

## Data source and networking

TMDB remains Showtime's only metadata provider. When TV details open, the local Node server first requests the TV series details, identifies the highest numbered regular season with at least one announced episode or an unknown episode count, and then requests that season from TMDB. A future season explicitly reporting zero episodes remains visible with its start date but is not selected for an empty episode request. Movies continue to use one request. Watchlist continues to use AsyncStorage only and never requests details per saved item.

Failure to load the newest season must not discard otherwise valid TV details. The response returns `latestSeason: null`, allowing the mobile screen to explain that episode information is temporarily unavailable while retaining season-level tracking.

The server validates IDs, episode numbers, names, and real ISO calendar dates. It does not decide whether a date is past. The mobile app compares date-only values with the device-local calendar date.

## Air dates and countdown

Future season rows display `Starts DD/MM/YYYY` instead of the vague `Not airing yet`. Started seasons display their premiere date in UK format.

The mobile app uses TMDB's valid, non-past `next_episode_to_air` first. If it is missing, malformed, or past, the app selects the earliest valid today-or-future episode from `latestSeason.episodes`. It never displays a negative countdown or implies a UK broadcast time.

## Episode interface

The newest relevant regular season is the highest numbered regular season selected by the networking rule above. Its episode list is visible beneath the season row, including when the announced episodes are all in the future.

- Episodes dated today or earlier can be marked watched or unwatched.
- Future episodes remain visible and disabled, with a UK date and countdown.
- Episodes without a valid air date remain visible and disabled with `Air date unavailable`.
- Older seasons retain whole-season watched controls.
- Specials remain visible and untracked.
- If newest-season episode details are unavailable, the existing season-level control remains available after the season starts.

The newest season is counted as complete only when every known valid episode number is trackable and watched. If TMDB later adds an episode, local metadata synchronisation makes the season incomplete until that episode airs and is watched.

## Local persistence

Use `showtime.tv-progress.v2` with this logical shape:

```ts
type EpisodeProgress = {
  seasonNumber: number;
  knownEpisodeNumbers: number[];
  trackableEpisodeNumbers: number[];
  watchedEpisodeNumbers: number[];
};

type TvProgress = {
  tvId: number;
  trackableSeasonNumbers: number[];
  watchedSeasonNumbers: number[];
  episodeProgress: EpisodeProgress[];
};
```

All number arrays are positive, unique, and sorted. Duplicate TV and season records are merged by union. Stale watched values remain stored but do not affect current displayed totals.

`episodeProgress` can contain one record for every regular season, even though Phase 5 populates only the newest relevant season. When a season has an episode-progress record, that record is authoritative for its completion and its legacy whole-season value is removed. If a v1 whole-season choice is converted, all episodes trackable on that device-local date begin as watched. Expanding episode tracking to older seasons therefore requires fetching and attaching more per-season records, not a v3 storage shape.

When v2 is missing, valid v1 season progress is read and converted in memory with an empty `episodeProgress` array. The next successful tracking write persists v2. A malformed v2 value remains unavailable and is never replaced from v1 or written back as empty. A malformed v1 value is also unavailable. The v1 key is retained.

Episode and season write failures restore the previous UI snapshot and display a retry message. Watchlist removal never removes progress.

## Watchlist

Watchlist loads the entire progress collection once from AsyncStorage. TV rows retain the season summary and append newest-season progress when aired episodes exist, for example:

`14 of 15 seasons watched · S15: 3 of 4 aired episodes watched`

Movie rows remain unchanged.

## Scope boundary

Phase 5 includes episode tracking only for the newest regular season. Browsing and tracking episodes in every older season, notifications, ratings, favourites, and personalised recommendations remain Future Refinements.

## Verification

Automated verification covers server mapping and partial failures, fallback next-episode selection, date-only labels, v1 migration, malformed v1/v2 data, deterministic v2 persistence, duplicate merging, future and missing episode dates, completion calculation, write rollback, Watchlist labels, and the absence of per-item Watchlist requests.

Physical iPhone verification covers Chicago Fire's `Starts 07/10/2026` label and fallback countdown, episode controls as dates pass, persistence after restarting Expo Go, Watchlist progress, remove/re-add preservation, Specials, and unchanged movie details.
