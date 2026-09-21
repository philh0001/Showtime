# Wide desktop layout release — 21 September 2026

Website release `v1.1.9` widens the four main tabs from a 1120px to an 1800px content cap. Home places its release sections in desktop columns and enlarges poster rails. Search presents results in responsive cards. Watchlist's existing one-to-four-column grid uses the wider area, and Profile's two desktop columns expand. The phone layout retains its previous sizing and stack order.

`npm run app:check` passed with 140 tests, no lint errors and one existing unused-disable warning. `npm --prefix production/web run check` passed the web export, bundle verification, 18 tests, Wrangler dry run, audit and secret scan. Local headless Chrome screenshots were reviewed at 1920px for all four tabs with an empty guest library; populated desktop cards and physical phone browsers were not checked in this release.

Only `showtime-web` was deployed, as version `465fd724-e7a6-46be-a8fa-e1eb79bfc8aa`. The API Worker and D1 were unchanged. Live `/`, `/search`, `/watchlist` and `/profile` returned HTTP 200, and the served browser bundle contains `v1.1.9`.
