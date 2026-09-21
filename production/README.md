# Production

`production/` owns every deployable Cloudflare component for Showtime's web-first live service. Local/UAT tooling is outside this tree and is never deployed.

## Live services

- Website: `https://showtimetracker.show`
- API custom domain: `https://api.showtimetracker.show`
- Legacy web hostname: `https://showtime-web.showtime-workers.workers.dev`
  (live HTTP 200 on 21 September 2026; source expects a 301 redirect)
- Workers: `showtime-web` and `showtime-api`

## Architecture

`app/` is exported into `production/web/dist/` and served by the Static Assets Worker. `production/api/` imports the shared TMDB core, calls TMDB with a Worker secret, and uses D1 for accounts/sync plus Resend for account email.

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

The sync revision change prepared in this worktree requires `api/migrations/0002_sync_revision.sql` before its API Worker is deployed. The migration adds a revision to existing sync rows; the updated API rejects old clients' unversioned pushes. Release the API and web changes together after hosted acceptance testing. None of these operations has been run against the live database or Workers for this change. See [Library sync design](../docs/SYNC-DESIGN.md).

## Safety and rollback

Wrangler dry runs do not prove remote secrets, routes, D1 bindings or email configuration. List deployed versions before rollback. A code rollback does not reverse D1 data or migrations, so assess data compatibility separately.

See [Deployment and Distribution](../docs/DEPLOYMENT-AND-DISTRIBUTION.md) for architecture and [the operations runbook](../docs/CLOUDFLARE-RUNBOOK.md) for release and recovery steps.
