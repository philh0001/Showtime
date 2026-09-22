# Showtime Roadmap

Showtime is web-first. The live website is `https://showtimetracker.show` and
the API is `https://api.showtimetracker.show`. The shared client and TMDB core
live in `app/` and `shared/`; deployable Cloudflare code lives in
`production/`, while `local-uat/` holds local-only acceptance tooling. Native
distribution remains a possible later direction.

The dated milestone notes below record how the project reached this point.
Open checkboxes still need verification or implementation.

## Phase 1 — Foundation

Status: Complete

- [x] Create GitHub repository
- [x] Clone repository locally
- [x] Create development branch
- [x] Create Expo / React Native project
- [x] Run app on physical iPhone
- [x] Replace default Expo Home screen
- [x] Add Home, Search, Watchlist and Profile navigation
- [x] Add project development instructions
- [x] Add project context documentation
- [x] Remove remaining Expo starter/demo code
- [x] Verify clean project structure
- [x] Verify lint and TypeScript checks
- [x] Verify all four tabs on physical iPhone
- [x] Commit foundation milestone

At the foundation milestone, app icons and splash artwork were placeholders;
later web branding work is tracked under Phase 7.

---

## Phase 2 — Movie & TV Search

Status: Complete for the first local version

- [x] Choose TMDB as the movie/TV data provider
- [x] Configure TMDB access securely
- [x] Keep TMDB credentials outside the mobile app
- [x] Create the local Showtime API/server
- [x] Build Search screen
- [x] Search movies and TV shows
- [x] Filter out people from TMDB multi-search
- [x] Display posters
- [x] Display titles
- [x] Display release year
- [x] Display Movie / TV media type
- [x] Add loading state
- [x] Add error state
- [x] Add empty/no-results state
- [x] Add five recent search suggestions
- [x] Persist recent searches locally
- [x] Add TMDB credits/attribution on Search
- [x] Verify Search on physical iPhone

Local/UAT limitation:

The `local-uat/` TMDB proxy runs on the development PC and is intended only
for private local testing. The public site uses the deployed API Worker.

Future refinement:

- Search pagination
- Additional filters such as Movie / TV
- Optional year and genre filters

---

## Phase 3 — Content Details

Status: Complete

- [x] Create dynamic movie detail route
- [x] Create dynamic TV detail route
- [x] Keep detail routes above the main tab navigator
- [x] Preserve Search state when returning from details
- [x] Display poster/backdrop
- [x] Display overview
- [x] Display rating
- [x] Display genres
- [x] Display release information
- [x] Display TV seasons
- [x] Display episode counts
- [x] Add loading state
- [x] Add retry/error state
- [x] Add invalid-route handling
- [x] Verify Movie details on physical iPhone
- [x] Verify TV details on physical iPhone
- [x] Verify Back navigation and all four tabs

Future refinements:

- Streaming/watch-provider information

Official trailers and cast/crew information are implemented.

---

## Phase 4 — Watchlist

Status: Complete

- [x] Add movies to Watchlist
- [x] Add TV shows to Watchlist
- [x] Remove saved titles
- [x] Build Watchlist screen
- [x] Persist Watchlist locally with AsyncStorage
- [x] Render saved titles without another TMDB request
- [x] Open saved titles back into their detail routes
- [x] Add loading state
- [x] Add empty state
- [x] Add storage-error handling
- [x] Verify persistence on physical iPhone

Future refinement:

- Denser poster/grid layout
- Filter by Movies / TV
- Sort by title, date added or release date

---

## Phase 5 — TV Tracking & Air-Date Countdown

Status: Complete

Design document:

`docs/superpowers/specs/2026-09-12-tv-tracking-design.md`

Newest-season extension:

`docs/superpowers/specs/2026-09-13-latest-season-episode-tracking-design.md`

### Season tracking

- [x] Mark regular TV seasons as watched
- [x] Mark regular TV seasons as unwatched
- [x] Exclude Specials from tracking
- [x] Keep Specials visible in TV details
- [x] Display watched season progress on TV details
- [x] Display watched season progress in Watchlist
- [x] Persist TV progress locally with AsyncStorage
- [x] Use versioned local storage
- [x] Preserve viewing progress independently from Watchlist membership
- [x] Restore progress when a removed show is added to Watchlist again

### Trackable seasons

- [x] Include seasons that have started airing
- [x] Exclude seasons with a known future first-air date
- [x] Treat seasons without an air date as trackable
- [x] Retain stale watched values without counting them in current progress

### Upcoming episodes

- [x] Map TMDB `next_episode_to_air`
- [x] Validate next-episode data on the local server
- [x] Compare air dates against the device-local calendar date
- [x] Display season and episode number
- [x] Display optional episode title
- [x] Display UK `DD/MM/YYYY` air date
- [x] Display `Airs today`
- [x] Display `Airs tomorrow`
- [x] Display `Airs in N days`
- [x] Display a safe message when no upcoming episode is announced
- [x] Never display negative countdowns
- [x] Fetch detailed episode data for the newest relevant regular season
- [x] Fall back to the season episode list when `next_episode_to_air` is missing or stale
- [x] Show exact `Starts DD/MM/YYYY` copy for future seasons

### Newest-season episode tracking

- [x] Keep the latest regular season easy to find
- [x] Display individual episodes and their air dates
- [x] Mark aired episodes watched or unwatched
- [x] Keep future and undated episodes visible but disabled
- [x] Mark or clear all aired episodes in one action
- [x] Derive newest-season completion from episode progress
- [x] Keep older seasons on whole-season controls
- [x] Keep the stored model capable of holding episode progress for multiple seasons

### Storage reliability

- [x] Validate stored TV IDs and season values
- [x] Deduplicate stored season numbers
- [x] Merge duplicate valid TV progress records
- [x] Keep deterministic/sorted season arrays
- [x] Salvage valid records from partially malformed storage
- [x] Treat unreadable storage as temporarily unavailable
- [x] Never overwrite unreadable storage automatically
- [x] Restore previous UI state if a progress write fails
- [x] Migrate valid `showtime.tv-progress.v1` records into `showtime.tv-progress.v2`
- [x] Make episode progress authoritative when a season has detailed tracking

### Verification

- [x] Add server tests
- [x] Add date-only utility tests
- [x] Add progress/storage tests
- [x] Keep existing Search, Details, History and Watchlist tests passing
- [x] Run lint
- [x] Run TypeScript checks
- [x] Run Expo SDK dependency checks
- [x] Run iOS export
- [x] Verify season toggles on physical iPhone
- [x] Verify Watchlist progress on physical iPhone
- [x] Verify persistence after restarting Expo Go
- [x] Verify Specials remain untracked
- [x] Verify movie behavior remains unchanged
- [x] Verify the newest-season episode list on physical iPhone
- [x] Verify future episodes are visible and disabled
- [x] Verify the next-episode display and UK countdown on physical iPhone

Future refinement:

- Extend the existing v2 episode model to older seasons when the added network
  and interface complexity provides enough value

---

## Phase 6 — Home, Viewing History & Discovery

Status: Implemented; expanded browser and iPhone verification remains open

At the September 2026 milestone, Home gained a local dashboard with viewing
activity, upcoming episodes, and discovery content.

13 September update: Continue Watching, movie watched status, local upcoming
schedules, and Trending Movies/TV are implemented and browser-tested. The new
features still need a physical iPhone pass. Upcoming schedules refresh when TV
details open, and show their last-checked date; Home does not fetch every show.
Chronological TV/movie activity history is also implemented for newly recorded
actions, with filters and detail links. Earlier activity is not reconstructed.

### Home dashboard

- [x] Redesign the Home screen
- [x] Add Showtime header/branding
- [x] Add useful first-use/empty state
- [x] Add quick access to Search
- [x] Use poster-based horizontal content rails
- [x] Add consistent card and spacing design

### Continue Watching

- [x] Show partially watched TV shows
- [x] Display season progress
- [x] Add visual progress bars
- [x] Open directly into the relevant TV detail page

### Movie watched status

- [x] Add `Watched` status for movies
- [x] Keep `Want to Watch` and `Watched` as separate concepts
- [x] Keep watched movies in the Watchlist until they are manually removed
- [x] Show a clear watched badge and poster treatment
- [x] Add All, To Watch and Watched Watchlist filters
- [x] Persist movie watched state locally

### Viewing history

- [x] Add viewing history
- [x] Record watched movies
- [x] Add a Watched Movies rail to Home
- [x] Record TV progress/activity
- [x] Add Recently Viewed titles
- [x] Persist Recently Viewed locally
- [x] Persist full viewing history locally

### Upcoming episodes

- [x] Design how upcoming episode data should be cached/refreshed for Home
- [x] Add an Up Next / Upcoming Episodes section
- [x] Avoid one network request per tracked TV show
- [x] Show useful countdown information

### Watchlist preview

- [x] Add horizontal Watchlist preview
- [x] Add See All navigation into the full Watchlist

### Discovery

- [x] Add Trending Movies
- [x] Add Trending TV
- [ ] Add Popular Movies/TV if useful
- [x] Define sensible refresh behavior
- [x] Avoid unnecessary background requests

### Verification

- [x] Verify Home updates after Watchlist changes
- [x] Verify Recently Viewed ordering and persistence
- [x] Verify Home updates after TV tracking changes
- [x] Verify Home updates after movie watched changes
- [x] Verify useful empty/new-user state
- [x] Verify Home on physical iPhone
- [ ] Verify the expanded Home, viewing history and Profile on physical iPhone

---

## Phase 7 — Profile & App Polish

Status: In progress; web-first polish is implemented, with checks below open

This phase added Profile content and the first major web branding pass. The
remaining polish and verification items stay open below.

### Profile

- [x] Add useful Profile content
- [x] Display Watchlist count
- [x] Display movies watched
- [x] Display TV seasons watched
- [x] Display shows being tracked
- [x] Add viewing statistics
- [x] Add settings

### About & credits

- [x] Add About / Credits area
- [x] Add required TMDB attribution
- [x] Add approved TMDB logo/notice where required
- [x] Add application version information

### App polish

- [ ] Replace placeholder app icon
- [ ] Replace placeholder splash artwork
- [ ] Establish final Showtime branding
- [ ] Review typography
- [ ] Review spacing
- [ ] Redesign Home across iPhone, tablet and desktop to address unused space
- [ ] Evaluate responsive grids or side-by-side sections for short title lists and upcoming episodes
- [ ] Reassess iPhone content density alongside responsive content widths and breakpoints
- [ ] Verify the design with sparse and populated collections on phone, tablet and desktop
- [ ] Review poster/card consistency
- [ ] Review loading/error/empty-state consistency
- [ ] Simplify the TV tracking layout and reduce visual clutter
- [ ] Improve accessibility labels where required

Design feedback (13 September): the Home screenshot shows short poster rails and
episode rows clustered on the left, with large unused areas to the right. The
user confirms the same empty-space issue on iPhone, so this is not desktop-only.
Review section composition and sparse-list layouts across all screen sizes,
including iPhone content density. Defer further layout changes to this design
pass; smaller margins alone do not resolve it.

### Useful detail enhancements

- [ ] Investigate TMDB watch-provider information
- [ ] Add Where to Watch if the data is useful/reliable
- [x] Add trailer links
- [x] Add cast/crew information

---

## Phase 8 — Production Hosting & Public Web/PWA

Status: Deployed; acceptance checks below remain open

The public website and API are deployed. Their current source and release
commands live in `production/`; local acceptance tooling lives in
`local-uat/`. The current release procedure is in
[`CLOUDFLARE-RUNBOOK.md`](CLOUDFLARE-RUNBOOK.md).

The local/UAT architecture is:

`app/ browser client -> local-uat/api Node server -> shared/tmdb-api -> TMDB`

The deployed production architecture is:

`showtimetracker.show (showtime-web) -> api.showtimetracker.show (showtime-api) -> TMDB / D1`

The hosted web app and API remove the development-PC dependency for browser
use. There is no hosted UAT service, UAT D1 database or remote UAT secret set.
Physical-device, persistence and installability checks remain open.

### Production API

- [x] Add a Cloudflare operations and incident-response runbook
- [x] Enforce the documented mandatory no-go release conditions
- [x] Adapt the Showtime TMDB proxy for a Cloudflare Worker
- [x] Store the TMDB credential as a server-side Worker secret
- [x] Ensure the TMDB credential is never bundled into the browser client
- [x] Configure the production web client to use the hosted endpoint
- [x] Add production-safe server error handling
- [x] Add proportionate logging/monitoring without recording secrets
- [x] Add suitable request validation and public-traffic protections
- [x] Scan source and generated client output for credentials

### Independent operation

- [ ] Test Search away from home network
- [ ] Test Details away from home network
- [ ] Verify Showtime works over mobile data
- [ ] Verify Showtime works with the development PC switched off

### Public Web/PWA

- [x] Export the Expo web build for production
- [x] Deploy it with Cloudflare Workers Static Assets
- [x] Use a Cloudflare-provided hostname initially
- [x] Serve the canonical website at `https://showtimetracker.show`
- [x] Serve the API at `https://api.showtimetracker.show`
- [x] Separate production deployment code from local/UAT tooling
- [ ] Verify navigation and major flows in iPhone Safari
- [ ] Verify navigation and major flows in supported desktop browsers
- [ ] Verify persistent local storage for Watchlist, progress, history and settings
- [ ] Verify local data survives reloads and browser restarts on the same device
- [ ] Verify Add to Home Screen on iPhone
- [ ] Verify app-like standalone presentation where supported
- [ ] Test production-safe API, network and offline error behaviour

### Real-user feedback

- [ ] Share the public URL without mandatory signup
- [ ] Observe onboarding, navigation, layout and persistence issues
- [ ] Decide from real usage whether accounts/cloud sync are needed
- [ ] Decide whether a later native application would add enough value

---

## Phase 9 — Accounts & Cloud Sync

Status: Implemented with a known sync gap

Authentication is working: users can create accounts and log in. The account
sync implementation currently has a known hydration and merge problem, tracked
below. Guest/local use remains available while this is resolved.

### Known issue — Account login does not hydrate or merge synced media state

#### Current behaviour

After a user logs in to an existing account, authentication succeeds but the
app does not reliably hydrate the account's previously saved TV shows, films,
Watchlist, or viewing progress into the local UI. The Profile **Sync** action
also appears to have no effect.

Guest-to-account behavior is incorrect. For example:

- Guest/local state: **TV Show A**
- Existing account/cloud state: **TV Show B** and **Movie C**
- Current result after login or Sync: only **TV Show A** remains visible;
  **TV Show B** and **Movie C** do not appear.

A clean browser logging in to a populated account also does not reliably
download and display that account's saved data.

#### Expected behaviour

After login, Showtime must merge the guest/local and remote account datasets
without losing either side. In the example above, the local UI and the account
should contain **TV Show A**, **TV Show B**, and **Movie C**. The merged data
must be persisted remotely and restored when the account is used on another
browser or device.

#### Future investigation scope

- Login hydration and the remote pull that follows authentication
- Guest-to-account migration
- Local/remote collection merge behavior
- D1 persistence and retrieval
- The Profile manual Sync pull/push/merge behavior
- Frontend store and UI-state refresh after synced data changes
- Multi-device restore on a clean browser or device

#### Future acceptance criteria

- [ ] **Clean client + populated account:** logging in restores the account's
  saved Watchlist, films, TV shows, and viewing progress into the UI.
- [ ] **Guest local data + populated account:** login merges both datasets
  without losing either side.
- [ ] **Merge example:** Guest = **Show A**; Remote = **Show B** +
  **Movie C**; after login = **Show A**, **Show B**, and **Movie C**.
- [ ] The merged result is persisted to the account remotely.
- [ ] A second clean browser or device logging into that account receives the
  merged state.
- [ ] Manual Sync genuinely pulls, pushes, and merges data rather than only
  refreshing authentication state.
- [ ] Sync failures do not destroy guest/local data.
- [ ] Repeated sync does not create duplicate records.

Accounts use optional email/password authentication and Cloudflare D1-backed
storage. They are not required for public release; guest/local mode remains
available while the known sync gap is resolved.

- [x] Add optional email/password accounts
- [x] Use Cloudflare D1 for account storage
- [ ] Cloud-sync Watchlist
- [ ] Cloud-sync movie watched history
- [ ] Cloud-sync TV progress
- [ ] Cloud-sync settings
- [ ] Add multi-device support
- [ ] Define migration from local-only data

The model is guest/local mode plus an optional account for cloud backup and
synchronisation. Completion of the unchecked sync work depends on resolving the
known hydration and merge issue above.

---

## Future Refinements

These are intentionally outside the core v1 path.

- [ ] Full episode-level tracking for older TV seasons
- [ ] Personal movie/TV ratings
- [ ] Favourites
- [ ] Search pagination
- [ ] Advanced Search filters
- [ ] Denser Watchlist grid
- [ ] Local notifications for upcoming episodes
- [ ] Personalised recommendations
- [ ] Favourite genres
- [ ] More detailed viewing statistics
- [ ] Improved discovery categories
- [ ] Optional recommendations based on viewing history
- [ ] Native iOS distribution through Expo/EAS, TestFlight and the App Store if
  Web/PWA feedback shows that native capabilities justify it
- [ ] Native iOS widget if a later native application makes it worthwhile

Avoid adding social features, reviews, friends, chat or other large subsystems
until the core Showtime experience is complete.

---

## Portfolio

Throughout development:

- [x] Maintain meaningful Git commits
- [x] Keep README/setup instructions updated
- [x] Document important technical decisions
- [x] Document TMDB API integration
- [x] Document secure credential handling
- [x] Maintain project context and roadmap documentation
- [x] Add screenshots of key milestones
- [x] Document TV tracking architecture
- [x] Document planned hosted API and public-distribution architecture
- [ ] Document database/authentication design if introduced
- [ ] Add final architecture overview
- [ ] Add final app screenshots
- [ ] Add portfolio-ready project summary
- [ ] Add final setup/run instructions for the completed architecture
