# iPhone help collapse release — 21 September 2026

Website release `v1.1.2` makes the Profile page's “Add Showtime to your iPhone” guide start closed. The button opens and closes the steps and exposes `aria-expanded` for screen readers. The Home install tip remains separately dismissible and appears only on a supported iPhone browser.

## Verification

- Before the change, a 390px browser check found the Profile instructions expanded and no toggle. After the change, the same check found the steps hidden initially, then visible after opening and hidden again after closing, with the matching `aria-expanded` state and no horizontal overflow.
- `npm run check` passed, including client lint and typecheck, 121 client tests, API and web tests, export, Worker dry runs, audits and credential scan. Lint reported one pre-existing unused-disable warning and no errors.
- Only `showtime-web` was deployed. Cloudflare Worker version: `8af0909e-3cfa-4bbe-98c3-32e4319deaa0`. The API Worker and D1 were unchanged.
- Live `/profile` returned HTTP 200 and served the `v1.1.2` entry bundle. A live 390px headless Chrome check confirmed the closed, open and closed states. The legacy Workers hostname still returned HTTP 301 while preserving path and query.

The owner also reported a separate problem with the installed iPhone experience and is providing screenshots. This release only addresses the size of the Profile guide; that other issue remains to be diagnosed.
