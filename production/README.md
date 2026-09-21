# Production

`production/` owns every deployable Cloudflare component for Showtime's web-first live service. Local/UAT tooling is outside this tree and is never deployed.

## Live services

- Website: `https://showtimetracker.show`
- Current website version: v1.1.0 (shown under Profile → About Showtime)
- API custom domain: `https://api.showtimetracker.show`
- Legacy web hostname: `https://showtime-web.showtime-workers.workers.dev`
  (redirect-only; a live request on 21 September 2026 returned 301 with path and query preserved)
- Workers: `showtime-web` and `showtime-api`

## Architecture

`app/` is exported into `production/web/dist/` and served by the Static Assets Worker. `production/api/` imports the shared TMDB core, calls TMDB with a Worker secret, and uses D1 for accounts/sync plus Resend for account email.

The Today-first Home branch adds `GET /schedule/tv/:id` to the public TMDB API. It fetches a TV summary and at most 12 regular seasons with at most three parallel season requests; the response caps dated episodes at 200 and reports per-season coverage. The route reserves 13 work units under the existing detail-category and work limits. Complete and cap-limited responses use the existing ten-minute API cache; temporary partials and errors are not cached. This route is branch work until a separately reviewed deployment.

Neither production package may import `local-uat/`. Shared behaviour belongs in `app/` or `shared/`.

## Install

From the repository root:

```sh
npm --prefix app ci
npm --prefix production/api ci
npm --prefix production/web ci
```

## Build and check

```sh
npm run production:build
npm run production:check
```

The gate checks the client, production API, web export, Worker bundles, audits, resource identities, credentials and the embedded canonical API URL. It does not deploy.

## Deploy web

After a reviewed, passing release gate and production-account authentication:

```sh
npm run production:deploy:web
```

This targets `showtime-web`. Verify the homepage, a deep route, the legacy redirect and the API URL in the served bundle.

## Deploy API

After confirming remote secrets, bindings and any separately reviewed D1 migration:

```sh
npm run production:deploy:api
```

This targets `showtime-api`. Deployment does not automatically apply D1 migrations. Run the remote smoke sequence in [the Cloudflare runbook](../docs/CLOUDFLARE-RUNBOOK.md).

The sync revision migration `api/migrations/0002_sync_revision.sql` was applied to the production D1 database on 21 September 2026 before the API and web Workers were deployed. Existing sync rows remained present at revision 1. The updated API rejects old clients' unversioned pushes. The production smoke suite passed, but a real account and second-device merge still needs a hosted acceptance check. See [Library sync design](../docs/SYNC-DESIGN.md) and the [release record](../docs/verification/2026-09-21-account-sync-production.md).

## Safety and rollback

Wrangler dry runs do not prove remote secrets, routes, D1 bindings or email configuration. List deployed versions before rollback. A code rollback does not reverse D1 data or migrations, so assess data compatibility separately.

See [Deployment and Distribution](../docs/DEPLOYMENT-AND-DISTRIBUTION.md) for architecture and [the operations runbook](../docs/CLOUDFLARE-RUNBOOK.md) for release and recovery steps.
