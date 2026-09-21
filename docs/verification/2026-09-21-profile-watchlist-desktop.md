# Profile and Watchlist desktop layout — 21 September 2026

Website release `v1.1.5` responds to the owner's desktop feedback. Watchlist now uses the existing 1120px page width used by Search. Profile uses the same width and places Recent Activity and Your Library beside Account, Settings, iPhone installation help, and About on screens at least 900px wide. The phone layout remains stacked.

## Verification and deployment

- `npm run production:check` passed after the final responsive change. App lint reported one existing unused-disable warning and no errors; typechecks, tests, web export, Worker dry runs, audits, bundle verification, and credential scan completed.
- In local and live Chrome checks at 1440px, Watchlist and Profile each had a 1120px content width and no horizontal overflow. At 390px, both pages fit the viewport; Profile's Account section remained visible in the normal stacked flow. The browser checks used an empty guest library.
- Only `showtime-web` was deployed. Cloudflare Worker version: `a176e58f-231d-4f07-a6d1-f4cfaea0ced6`. The API Worker and D1 were unchanged.
- Live `/`, `/watchlist`, and `/profile` returned HTTP 200, and the live browser loaded the v1.1.5 bundle.
