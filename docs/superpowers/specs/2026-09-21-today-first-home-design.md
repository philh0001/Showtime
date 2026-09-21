# Today-first Home design

## Intent and scope

Make Home answer: “What is on today, and what is coming this week from the TV shows I follow?” The top-left phone in the supplied visual is the layout reference. This changes Home and its schedule metadata flow. Search, Watchlist, Profile, account authentication, sync storage, and watched controls retain their existing roles.

The canonical set of followed shows is TV entries in the existing Watchlist. Saved movies remain in the Home Watchlist strip. A TV show with viewing progress but absent from Watchlist does not enter the release schedule. Opening a detail page never marks an episode watched. Watched status does not remove a dated release.

## Home layout

On phones, use one column in this order: compact branded header and Search access; Today; This Week; Coming Soon; Your Watchlist; then existing Continue Watching, Recently Viewed, Watched Movies, and optional Trending. Today starts within the first viewport. Use current design tokens, compact poster rows, readable text, accessible touch targets, and existing four tabs. No broadcast time, fictional content, hero banner, desktop sidebar, or new screen.

Today lists all saved-show episodes whose original air date equals the device-local calendar date, for the entire day. Rows show poster, show title, season/episode number, episode title when supplied, and a Today badge. Tapping a row opens `/tv/[id]`. Multiple episodes of the same show on one date form one expandable row with a count; expansion reveals each episode. The row's navigation and expansion controls must be separate accessible targets.

This Week lists dates strictly after today through the current Sunday. Group chronologically under friendly day headings, including “Tomorrow · Tuesday” when applicable. It never repeats Today. Home shows a manageable preview; an accessible in-place expansion reveals the rest. Coming Soon lists the next known releases after Sunday in date order, with a compact preview and expansion. Season-one episode one may be labelled a series premiere; episode one of a later season may be labelled a season premiere. No other “returning” claim is inferred. “See all” appears only for a real destination or expansion. Full dates use DD/MM/YYYY.

Your Watchlist is a small poster strip with existing Watchlist navigation and both TV and movie entries. Desktop uses the same hierarchy in a centered maximum-width area, with balanced columns only where useful. No horizontal page overflow.

## Data contract and coverage

The existing `showtime.tv-schedule.v1` cache is written only after a TV detail visit and holds one next episode plus the newest season. `getUpcomingEpisodes` selects one unwatched entry per show. It cannot supply this Home design.

Add `GET /schedule/tv/:id` to the shared TMDB API, with local/UAT and production adapters. It returns safe title/poster metadata, dated regular-season episodes, and `coverage: complete | partial`. It fetches the TV summary and at most 12 newest regular seasons with positive episode counts, using at most three concurrent season requests. Exclude specials and malformed or undated episodes. Keep dates from two days before the server's UTC date onward so users at the edges of time zones do not lose their local Today. Deduplicate by TMDB episode ID, then season/episode identity; sort by calendar date and episode. Return at most the earliest 200 dated episodes. Keep the TMDB token server-side. A failed season fetch, omitted season, or episode cap makes coverage partial; it must never produce a confidently empty result. The response does not assert UK availability. Production applies the existing CORS, rate limit, and cache mechanisms to the new route.

The client validates this response and stores it in the existing device-local schedule cache with checked-at and coverage metadata, extending the shape compatibly. Old detail-derived records are partial. A later detail visit may seed a missing cache record but must not replace a complete schedule with a single-season snapshot. On Home focus, read cached schedules immediately, then fetch only missing or stale saved shows. A new show added locally or via account sync becomes eligible immediately. Use at most two concurrent client requests and a twelve-hour freshness window, with explicit retry bypassing freshness. A refresh failure preserves prior per-show data and exposes a separate refresh-error flag. Schedule metadata stays device-local and outside D1 sync. Removing a show removes it from Home's derived schedule without deleting shared Watchlist or progress data.

The UI derives Today, This Week and Coming Soon from one deduplicated dated episode list. Compare ISO calendar dates as dates, never by converting an air date into a timestamp. Recalculate on focus, app resume, and local day change. Unknown dates are not guessed or shown in a dated section. A partial result receives a visible “Schedule may be incomplete” label. A true “Nothing new from your shows today” message is shown only after a successful check; include the next known release if one exists. An entirely empty confirmed schedule says no dates are announced. First-time loading uses row-shaped skeletons. A new user gets a Search link. A refresh error has retry and keeps previously loaded rows visible.

## Verification and boundaries

Cover grouping, episode deduplication, watched independence, day and year boundaries, stale and partial data, add/remove/sync changes, and opening a show without marking watched. Check narrow phone and desktop widths, keyboard navigation, labels, tap targets, loading and retry states, and horizontal overflow. Run app, local API, production API and repository checks; capture phone and desktop screenshots. No deployment is part of this work.

Start implementation from the web-first `feature/cloudflare-api` line in a separate worktree. The older rollback checkout has uncommitted Home changes. Recheck branch and worktree status before editing; do not overwrite either checkout. No account/auth, sync schema, D1 migration, or production release change is needed.
