# Account entry and iPhone install release — 21 September 2026

Website release `v1.1.1` adds desktop Home header links for Sign in and Create account, a brief Home confirmation after registration, and an iPhone Safari installation guide on Home with persistent help in Profile. The website now exports a Showtime manifest, Home Screen icons, browser favicon and app title. The guide explains that Safari and the installed Home Screen app have separate local storage, so a verified account is needed to transfer a guest library.

## Verification

- `npm run check` passed: 4 repository structure tests, 65 local API/shared tests, 121 client tests, 36 API service tests, 88 API Worker tests across 8 files, and 18 web tests. Typechecks, lint, web export, Worker dry runs, bundle checks, audits and credential scan completed. The audits found 0 vulnerabilities.
- A local Cloudflare web Worker served the final export. Headless Chrome at a true 390px iPhone-sized viewport showed the install tip, its account link, and no horizontal overflow (`scrollWidth=390`); the desktop account promotion was hidden at that width.
- At 950px, a browser check opened Create account from the Home header, submitted a mocked successful sign-up response, and reached `/?welcome=account-created` with the confirmation card and signed-in header. The mock made no real account and sent no email.
- Only `showtime-web` was deployed. Cloudflare Worker version: `3a31cc20-1223-48c3-a0db-96bfcbfe3ad7`. The API Worker and D1 were unchanged.
- Live `https://showtimetracker.show/`, `/account?mode=sign-up`, `/profile`, `/manifest.json` and `/apple-touch-icon.png` returned HTTP 200. The live entry bundle contained the install guide, account confirmation and `1.1.1` label. The legacy Workers hostname returned HTTP 301 to `https://showtimetracker.show/search?q=batman`, preserving the path and query.

## Remaining acceptance check

On a real iPhone, save a guest title in Safari, create and verify an account, confirm sync, add the site to the Home Screen, then sign in from the icon and confirm the title appears once. This also checks the actual Safari install flow and Resend email delivery. No controlled production account or iPhone was available for this release check, so the live cross-context restore remains unverified.
