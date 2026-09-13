# Roadmap Progress: 13 September 2026

## Delivered

- Continue Watching with season totals, fractional episode progress, detail links,
  and persistent title metadata after Recently Viewed eviction.
- Profile totals for Watchlist, watched movies/seasons, actively tracked shows,
  and individually tracked episodes. Independent unavailable states and retry.
- Profile settings with a persistent Trending switch, version and TMDB credits.
- Trending Movies/TV through one local `/discovery` request. Weekly lists, 30-minute
  caches, concurrent-request sharing, safe errors, and retained lists after offline refresh.
- Upcoming Episodes from a versioned local schedule cache populated by successful
  TV detail loads. Date-only UK countdowns, watched/past/Specials exclusion, last
  checked dates, and no per-show Home requests.
- Browser navigation no longer covers the header or overflows narrow screens.
  Link styling and progress accessibility now work in the browser.
- Persistent viewing history with movie/TV filters, action timestamps, rewatches,
  reversals and detail links. Primary and history write failures remain distinct.
- Official YouTube trailer links, cast portraits and key crew on Details, using
  optional data appended to the existing request.
- Root setup links, expanded mobile documentation, and updated roadmap.

Existing movie watched controls, Watchlist status filters and the Watched Movies
rail were already committed when this work started. Their integration was verified
and the stale roadmap checkboxes were updated.

## Verification

- `npm test`: 105 passing tests, zero failures.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npx expo install --check`: all SDK 57 dependencies up to date.
- `npx expo export --platform ios --max-workers 1`: passed with history and detail extras.
- Export credential scan: the TMDB token is absent from exported files.
- Headless Edge/Playwright: Home, Search, Watchlist and Profile at widths 320, 390,
  and 1440 pixels; no document overflow or uncaught browser errors.
- Browser interaction checks: season/episode changes update Home progress;
  marking a movie unwatched removes its Home watched rail entry and preserves
  Watchlist membership; Profile totals refresh; Trending preference persists;
  corrupted TV progress preserves independent movie totals and shows unavailable state.
- History browser checks: successful episode/movie actions appear in the timeline;
  movie/TV filters work; primary-write failures create no event; history-write
  failures preserve watched status and show the distinct error.
- Live Batman Begins detail page: cast images loaded, official trailer URL validated,
  no document overflow or uncaught errors.
- Live local API: real Trending Movies/TV lists loaded and poster assets rendered.
- Independent code review: two findings reproduced and fixed with regression tests
  (recent-history eviction and settings-save/focus races); follow-up review clear.
  History/detail additions also passed independent review.

Browser fixtures ran in an isolated context and did not modify physical-device
storage. Browser tooling was installed outside the app, in `D:\Dev\showtime-qa`.
It is not a new application dependency. The local QA scripts and additional
screenshots remain there for inspection.

Committed milestone screenshots use live TMDB data in a clean browser context:
[Home](../screenshots/home-web-390.png),
[Movie details](../screenshots/movie-web-390.png),
[Cast and trailer](../screenshots/cast-web-390.png).

## Data Semantics

`showtime.tv-schedule.v1` stores public TV title metadata and dated candidates.
It refreshes when details open, not automatically from Home. Previously tracked
shows need one detail visit to populate this new cache. A last-checked date is
shown because future schedules may change. This is not a UK broadcaster schedule.

`showtime.settings.v1` stores the Trending preference. Writes are serialized and
reads await pending writes. Unreadable settings disable discovery requests and
can be retried in Profile. Unreadable schedule storage is never silently replaced.

Movie watched state is a current collection. Marking unwatched removes that
record. The separate `showtime.viewing-activity.v1` timeline retains newly recorded
actions and reversals, including repeat viewings. Earlier events are not reconstructed.
TV progress retains its existing v2 schema.

## Remaining Work

- Physical iPhone check of all new sections, accessibility, persistence and tab returns.
- Final Showtime icon/splash branding and TV tracking layout polish.
- Watch-provider information, Search pagination and advanced filters.
- Hosted API, independent mobile-data operation, EAS/TestFlight distribution.
  The proxy remains a private development service.
- Accounts/cloud sync remain future work.

No deployment, push to main, hosted account creation, or credential changes were made.
