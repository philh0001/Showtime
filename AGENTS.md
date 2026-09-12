# Showtime Development Instructions

## Project

Showtime is a mobile application for tracking movies and TV shows,
discovering content, and maintaining a personal watchlist.

The project is being built as both a working application and a
portfolio project, so code quality, documentation, Git history,
and clear architectural decisions matter.

## Technology

Current stack:

- React Native
- Expo SDK 57
- Expo Router
- TypeScript
- Git and GitHub
- Physical iPhone testing through Expo Go

The mobile application lives in:

`mobile/`

Before changing anything inside `mobile/`, also read:

`mobile/AGENTS.md`

## Development approach

Work incrementally.

Before making a significant change:

1. Explain what is going to change.
2. Explain why the change is needed.
3. Keep the change small and focused.
4. Avoid adding unnecessary dependencies or abstractions.
5. Verify the result before moving on.

Do not make large unexplained changes across many files.

When introducing a new React, TypeScript, Expo, API, database,
or architectural concept, explain it in straightforward language.

## Verification

For mobile changes:

- Run the relevant lint/type checks.
- Verify the app still loads through Expo.
- Test important UI changes on the physical iPhone when appropriate.
- Do not claim something works without verification.

## Git

Use small, meaningful commits.

Do not commit:

- secrets
- API keys
- environment files containing secrets
- generated build output
- unnecessary temporary files

Do not push directly to `main` while feature work is in progress.

## Current navigation

The application currently has four primary areas:

- Home
- Search
- Watchlist
- Profile

## Current development phase

The project is still in its foundation stage.

Priorities are:

1. Establish a clean application structure.
2. Build the core navigation.
3. Add movie and TV discovery/search.
4. Add watchlist functionality.
5. Add user/profile functionality.
6. Add persistence/backend functionality when required.

Prefer building the simplest useful version first and expanding it
incrementally.