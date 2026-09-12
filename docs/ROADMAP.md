# Showtime Roadmap

## Phase 1 — Foundation

Status: Complete

- [x] Create GitHub repository
- [x] Clone repository locally
- [x] Create development branch
- [x] Create Expo / React Native project
- [x] Run app on physical iPhone
- [x] Replace default Expo Home screen
- [x] Add Home, Search, Watchlist and Profile navigation
- [x] Verify lint passes
- [x] Add project development instructions
- [x] Add project context documentation
- [x] Remove remaining Expo starter/demo code
- [x] Verify clean project structure
- [x] Commit foundation milestone

Cleanup is committed and verified on a physical iPhone. Configured app icons and
the native splash image remain placeholders for a later Showtime branding pass.

## Phase 2 — Movie & TV Search

Status: First local version complete. TMDB title search and the no-results
state were verified on a physical iPhone through Expo Go. Server error paths
are covered by automated tests. The server is for private local development,
not public deployment.

- [x] Choose movie/TV data API
- [x] Configure API access securely
- [x] Build Search screen
- [x] Search movies and TV shows
- [x] Display posters, titles and release information
- [x] Add loading states
- [x] Add error handling
- [x] Add empty/no-results state

## Phase 3 — Content Details

Status: Complete. Movie and TV details, Back navigation and the four tabs were
verified on a physical iPhone through Expo Go.

- [x] Create dynamic movie detail screen
- [x] Create dynamic TV detail screen
- [x] Display poster/backdrop
- [x] Display overview
- [x] Display rating
- [x] Display genres
- [x] Display release information
- [x] Display TV seasons

## Phase 4 — Watchlist

- [ ] Add item to watchlist
- [ ] Remove item from watchlist
- [ ] Build Watchlist screen
- [ ] Persist watchlist between app sessions

## Phase 5 — TV Tracking

- [ ] Mark TV seasons as watched
- [ ] Display viewing progress
- [ ] Store tracking data locally
- [ ] Decide whether episode-level tracking is worthwhile

## Phase 6 — Profile

- [ ] Build Profile screen
- [ ] Add viewing statistics
- [ ] Add settings
- [ ] Decide whether authentication is required

## Phase 7 — Backend & Accounts

Only introduce this when the app genuinely needs cloud persistence.

Possible future work:

- [ ] Database
- [ ] User authentication
- [ ] Cloud-synced watchlists
- [ ] Cloud-synced viewing progress
- [ ] Multi-device support

## Portfolio

Throughout development:

- [ ] Maintain meaningful Git commits
- [ ] Keep README updated
- [ ] Document important technical decisions
- [ ] Add screenshots of key milestones
- [ ] Document API integration
- [ ] Document database design when introduced
- [ ] Add final architecture overview
- [ ] Add setup/run instructions
