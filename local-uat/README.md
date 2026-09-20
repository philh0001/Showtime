# Local / UAT

## Purpose

This area is for browser-first development and acceptance testing before a change is promoted to production.

## Setup

Copy `.env.example` to `.env.local`, then set only the server-side `TMDB_READ_ACCESS_TOKEN`. Never expose that token through an `EXPO_PUBLIC_*` variable or commit `.env.local`.

## Run

Run both services with `npm run local`, or use `npm run local:api` and `npm run local:web` in separate terminals.

## Test

Run the local adapter tests with `npm run local:test` and the shared application gate with `npm run app:check`.

## Boundaries

The local Node service imports the environment-neutral handlers from `shared/tmdb-api`. It is a development adapter only and must never be deployed.

## UAT status

UAT is currently local only. There is no remote UAT domain, UAT secret store, or UAT D1 database.
