# Showtime Project Context

## Overview

Showtime is a mobile app for people who want to track movies and TV shows,
discover what to watch next, and maintain a personal watchlist.

The project is being built incrementally as both:

- a real working application
- a portfolio project demonstrating mobile development, APIs, Git, documentation,
  architecture, and later backend/database work

## Current technology

The current mobile stack is:

- React Native
- Expo SDK 57
- Expo Router
- TypeScript
- Expo Go for physical iPhone testing
- Git
- GitHub
- VS Code

The mobile application is located in:

`mobile/`

## Current Git workflow

Repository:

`showtime`

Current development branch:

`setup/foundation`

Feature work should be completed on branches rather than directly on `main`.

## Current application state

The Expo project has been successfully created and runs on a physical iPhone.

Expo CLI and Expo Go are configured and working.

The generated Expo starter Home screen has been replaced with an initial
Showtime screen.

The current Home screen contains:

- Showtime branding
- tagline: "Track what you watch. Discover what's next."
- Start exploring button
- dark visual theme

The app currently has four main navigation tabs:

1. Home
2. Search
3. Watchlist
4. Profile

The application has successfully been tested on a physical iPhone using Expo Go.

Lint and TypeScript checks passed after both cleanup passes. Startup and all four
tabs were then verified on a physical iPhone through Expo Go.

The Expo tutorial route, unused demo components and images, animated startup
overlay, and reset-project script have been removed. The mobile README now
documents Showtime setup and verification. Shared navigation/theme helpers remain
in use. Configured app icons and the native splash image remain placeholders.

Cleanup commits: `4b8863e` and `4de47df` on `setup/foundation`.

## Current development phase

Showtime has entered Phase 2: Movie and TV Search.

The first local TMDB Search and Content Details implementations are verified on
a physical iPhone through Expo Go.

## Planned core functionality

### Home

The Home screen will eventually provide useful personalised and discovery content,
such as:

- trending movies and TV shows
- currently popular content
- recommendations
- recently watched or tracked content

The exact Home experience will evolve as the rest of the application is built.

### Search

Users should be able to search for:

- movies
- TV shows

Search results should display useful information such as:

- poster
- title
- release year
- media type

Selecting a result should open a detailed page for that movie or TV show.

### Movie and TV details

A content detail screen should eventually include:

- poster/backdrop
- title
- description
- release information
- rating
- genres
- seasons for TV shows
- watchlist controls
- watched/tracking controls

### Watchlist

Users should be able to save movies and TV shows they want to watch.

The watchlist should eventually persist between app sessions.

### TV tracking

For TV shows, users should eventually be able to track progress.

Initial tracking may be deliberately simple.

For example:

- Season 1
- Season 2
- Season 3

More detailed episode-level tracking can be considered later if useful.

### Profile

The Profile section can eventually contain:

- user information
- viewing statistics
- settings
- account controls

Authentication does not need to be introduced until the app requires it.

## Development principles

Build the smallest useful version of each feature first.

Avoid introducing backend services, authentication, databases, or complex state
management before they are genuinely required.

Prefer simple, understandable architecture.

Important technical decisions should be documented.

Changes should be small enough to understand and verify.

## Learning approach

This project is also being used to learn application development.

When introducing concepts such as:

- React components
- React hooks
- TypeScript
- APIs
- asynchronous code
- routing
- state management
- databases
- authentication

they should be explained clearly rather than introduced as unexplained code.

Hands-on development is preferred over long theoretical explanations.

## Immediate next steps

The likely next stages are:

1. Preserve the verified Home, Search, Watchlist and Profile navigation.
2. Implement TV season tracking.
3. Add user/profile functionality as required.
4. Plan a secured hosted search server before public distribution.

These priorities may change as the project develops.

## Phase 2 implementation checkpoint

TMDB developer access and the computer-only search check work. The read access
token is stored in ignored `mobile/.env.local` and used only by Node scripts.
The app calls a separate local server on port 3001; it never receives the token.
Search shows first-page movie/TV matches with title, poster, year and media type,
plus loading, error and empty states. TMDB credits appear on Search.
The user verified title search and the empty state on a physical iPhone through
Expo Go. Lint, TypeScript, five server tests and an iOS export passed. A scan
confirmed the token was absent from mobile source and exported iOS files.
Public server deployment and pagination are not implemented.
See `mobile/README.md` for the two-terminal startup steps.

Recent-search suggestions are implemented with device-local AsyncStorage and
verified on a physical iPhone. Only the five newest successful title
queries are retained. The list is case-insensitive for duplicates, filters as
the user types, and can be cleared from Search. No search history is sent to a
server until the user runs a search.

## Phase 3 implementation checkpoint

Search results now open dynamic movie or TV routes above the existing tab
navigator. The four tab URLs remain unchanged, and returning from a detail screen
should preserve the current Search screen state. Detail pages request fresh TMDB
data through the same computer-only server and display artwork, overview, rating,
genres and release information. TV pages also list seasons and episode counts.
Loading, retry, missing-data and invalid-route states are included. Automated
server tests, lint, TypeScript and cross-platform export pass. Movie and TV
details, Back navigation and all four tabs were verified on a physical iPhone.

## Phase 4 implementation checkpoint

Movie and TV detail screens can add or remove a title from a device-local
watchlist. Saved items contain only the fields required to render the Watchlist
tab without another TMDB request. The tab reloads when focused, opens saved
titles back into their detail routes, supports removal, and includes loading,
empty and storage-error states. AsyncStorage persistence and the complete flow
were verified on a physical iPhone. The first version displays one title per
row; a denser multi-column layout is recorded as a future refinement.
