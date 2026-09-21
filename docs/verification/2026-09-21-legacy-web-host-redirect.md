# Legacy web hostname redirect release — 21 September 2026

Target: Cloudflare Worker `showtime-web` in the production account. The API Worker was not deployed.

- Previous web version: `f8d8a152-f782-48f7-8747-3a933ff562a4`.
- Deployed web version: `090db7a1-feb3-4af4-8e62-cfd8dfcf69e8`.
- Pre-deploy `npm run production:check`: passed, including the generated bundle check, tests, audits and both Worker dry runs.
- The deployed version has `assets.run_worker_first` enabled and an `ASSETS` binding.
- Old root `/` returned HTTP 301 to `https://showtimetracker.show/`.
- Old `/search?q=batman` returned HTTP 301 to `https://showtimetracker.show/search?q=batman`.
- Old `/favicon.ico` returned HTTP 301 to `https://showtimetracker.show/favicon.ico`.
- Canonical `/` and `/profile` returned HTTP 200. Its JavaScript asset reference matched the reviewed local build.
- Read-only live API smoke suite: 10 of 10 routes passed.

The old hostname remains reachable only to issue redirects. The site is served on the canonical domain. A web rollback to the previous version would also restore the old hostname's HTTP 200 behaviour; use the [Cloudflare runbook](../CLOUDFLARE-RUNBOOK.md) for incident steps.
