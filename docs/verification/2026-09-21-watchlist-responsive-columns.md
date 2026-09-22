# Watchlist responsive columns — 21 September 2026

Website release `v1.1.7` makes the Watchlist card count respond to available screen width. It keeps the phone list at one column and uses a 250px minimum card width for up to four columns inside the shared 1120px page width. The list remounts when the column count changes so resizing the browser updates its layout cleanly.

## Verification and deployment

- `npm run production:check` passed. App lint reported one existing unused-disable warning and no errors; typechecks, tests, web export, Worker dry runs, audits, bundle verification, and credential scan completed.
- Local and live Chrome checks used eight sample Watchlist titles in an isolated browser profile. At widths of 390px, 700px, 900px, and 1200px, the first row showed one, two, three, and four titles respectively. A 1096px boundary check showed four 250px cards. No width had horizontal overflow. Resizing the same local browser page through the four layouts and back also passed.
- Only `showtime-web` was deployed. Cloudflare Worker version: `c4070d53-eed2-41c7-bb38-e77b9e4ce72d`. The API Worker and D1 were unchanged.
- Live `/watchlist` returned HTTP 200 and served the v1.1.7 bundle.
