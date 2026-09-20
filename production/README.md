# Production

## Live services

The canonical website is `https://showtimetracker.show`, backed by the `showtime-web` Static Assets Worker. The API is the `showtime-api` Worker at `https://api.showtimetracker.show`. The legacy `showtime-web.showtime-workers.workers.dev` hostname redirects to the canonical website.

## Architecture

`app/` is exported into `production/web/dist/` and served by the web Worker. The API Worker calls TMDB and uses Cloudflare D1 for account and sync data plus Resend for account email.

## Install

Run `npm ci` in `app/`, `production/api/`, and `production/web/`. Each package owns its lockfile and dependencies.

## Build and check

From the repository root, use `npm run production:build` to create the browser bundle and `npm run production:check` for the complete non-deploying release gate.

## Deploy web

Run `npm run production:deploy:web` only after `npm run production:check` passes and Cloudflare authentication targets the production account. This deploys `showtime-web`. Afterwards, check the canonical homepage, a deep route, the legacy-host redirect, and the generated bundle's API URL.

## Deploy API

Run `npm run production:deploy:api` only after the API checks pass, required Worker secrets are configured remotely, and any D1 migration has been reviewed separately. This deploys `showtime-api`; it does not apply a database migration automatically. Run the remote smoke check after deployment.

## Safety

The Node server under `local-uat/` is never deployed. Wrangler dry runs validate packaging, but do not prove that remote secrets, routes, D1 bindings, or account configuration are correct.

## Rollback

List the relevant Worker's deployed versions before selecting a rollback target. A code rollback does not roll back D1 data or migrations, so assess data compatibility independently.
