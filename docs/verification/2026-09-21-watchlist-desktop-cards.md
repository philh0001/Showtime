# Watchlist desktop cards — 21 September 2026

Website release `v1.1.6` completes the desktop layout response. A populated Watchlist exposed excessive space in each full-width list row after the v1.1.5 width alignment. At 900px and wider, Watchlist now uses two cards per row with each title's poster, details, and Remove action together. The narrower phone layout remains a single list. Profile retains the two-column desktop layout and shared 1120px content width from v1.1.5.

## Verification and deployment

- `npm run production:check` passed. App lint reported one existing unused-disable warning and no errors; typechecks, tests, web export, Worker dry runs, audits, bundle verification, and credential scan completed.
- Local and live Chrome checks used three sample Watchlist titles in an isolated browser profile. At 1440px, the first two titles appeared in side-by-side cards and the third began the next row. At 390px, the existing single-column list remained. Watchlist and Profile fit both viewports without horizontal overflow.
- Only `showtime-web` was deployed. Cloudflare Worker version: `65692534-f99a-4129-9512-869feb5a94f8`. The API Worker and D1 were unchanged.
- Live `/`, `/watchlist`, and `/profile` returned HTTP 200 and the live browser loaded the v1.1.6 bundle.
