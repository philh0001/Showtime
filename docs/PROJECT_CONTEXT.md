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

Linting currently completes without errors.

## Current development phase

Showtime is in the foundation stage.

The main focus is building a clean structure before adding significant
application functionality.

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

1. Finish and verify the application foundation.
2. Clean up remaining Expo starter/demo code.
3. Establish the final basic navigation structure.
4. Create the Search screen.
5. Choose and integrate a movie/TV metadata API.
6. Display real search results.
7. Create movie and TV detail screens.
8. Implement watchlist functionality.
9. Add persistence.
10. Add user/profile functionality as required.

These priorities may change as the project develops.