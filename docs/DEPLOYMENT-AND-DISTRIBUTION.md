# Deployment and distribution

## Current release model

Showtime is a web-first application already deployed on Cloudflare:

- Canonical website: `https://showtimetracker.show`
- API custom domain: `https://api.showtimetracker.show`
- Web Worker: `showtime-web`
- API Worker: `showtime-api`
- Legacy web hostname: returns HTTP 301 to the canonical website, preserving
  the path and query string

Local/UAT is not hosted. `local-uat/api/` exists only for development and acceptance work and must never be deployed.

## Architecture

The shared client in `app/` is exported to `production/web/dist/`. The Static
Assets Worker serves the single-page application on the canonical domain and
redirects the old hostname. The browser calls the API Worker, which imports
`shared/tmdb-api/`, holds the TMDB credential server-side, applies CORS and
rate limits, and provides account/sync endpoints backed by D1.

```text
app/ -> production web export -> showtime-web
browser -> api.showtimetracker.show -> showtime-api -> TMDB / D1 / Resend
```

Production and local/UAT are adapters. Neither may import the other, and shared behaviour must not be duplicated between them.

## Install

From the repository root:

```sh
npm --prefix app ci
npm --prefix production/api ci
npm --prefix production/web ci
```

The three lockfiles are independent so app dependencies and production Worker tooling remain explicit.

## Non-deploying release gate

```sh
npm run production:check
```

This runs the client gate, API shared/Worker tests and typecheck, both Worker dry-run bundles, the production web export, dependency audits and credential scans. The generated JavaScript must contain `https://api.showtimetracker.show` and must not contain the TMDB credential, `localhost:3001`, an `api_key` parameter or the old API Workers hostname.

A passing gate proves source and packaging checks only. It does not prove remote secrets, D1 state, routing, email delivery or that a deployment occurred.

## Deploy

Deployment is always an explicit reviewed action:

```sh
npm run production:deploy:web
npm run production:deploy:api
```

Deploy only the intended component. Re-run the relevant post-deploy checks from [the Cloudflare runbook](CLOUDFLARE-RUNBOOK.md). Do not infer an API deployment from a website deployment or vice versa.

D1 migrations are separate data operations. Review and back up as appropriate before applying one; neither deploy nor rollback automatically changes the database schema.

## Environment and credential rules

- `TMDB_READ_ACCESS_TOKEN` is server-side only.
- Production secrets belong in Cloudflare Worker secrets, never source, app config or generated JavaScript.
- Local development secrets belong only in ignored `local-uat/.env.local`.
- The production web export may embed only the public API URL.
- CORS must allow the exact canonical frontend origin.
- Account email credentials and template configuration remain API Worker concerns.

## Browser and local data

The public Web/PWA release is the primary distribution channel. Guest data uses browser-local storage and can be lost if site data is cleared. Optional accounts are intended to provide backup and multi-device sync, but the known login hydration/merge gap must be resolved before that promise is considered complete.

Installation to an iPhone Home Screen is a browser/PWA capability, not a native App Store release. A future native client or widget should proceed only if web feedback demonstrates enough additional value.

## Cost and operations

Prefer bounded responses, caching, rate limits and Cloudflare's free/low-cost services. Do not encode changing quota or price figures in architecture decisions without checking current provider documentation.

Maintain rollback awareness for both Workers. Code rollback does not restore D1 data, reverse migrations or undo external email effects.
