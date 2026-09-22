# Cloudflare operations runbook

This runbook operates the web-first production environment only. The repository reorganisation itself did not deploy either Worker.

## Before any deployment

From the repository root, install pinned dependencies if required:

```sh
npm --prefix app ci
npm --prefix production/api ci
npm --prefix production/web ci
```

Run the complete non-deploying gate:

```sh
npm run production:check
```

Confirm:

- the generated bundle contains `https://api.showtimetracker.show`;
- no TMDB credential or `localhost:3001` appears in generated output;
- API resource identity tests still pin `showtime-api`, its custom domain, D1 ID and origins;
- web configuration still pins `showtime-web`, `src/worker.ts` and `./dist`;
- the authenticated Cloudflare account is the intended production account;
- required remote Worker secrets and bindings exist;
- any proposed D1 migration has a separate reviewed plan.

## Deploy the website

The old Workers hostname is redirect-only. Verify the 301 and its preserved path
and query after every web deployment.

```sh
npm run production:deploy:web
```

This deploys only `showtime-web`. Check:

1. `https://showtimetracker.show/` returns the new site.
2. A deep route such as `/profile` resolves through SPA fallback.
3. `https://showtime-web.showtime-workers.workers.dev/search?q=batman` redirects with path and query intact.
4. Search and discovery call `https://api.showtimetracker.show`.

## Deploy the API

For a future migration, first review a D1 recovery point and the proposed SQL.
The sync revision migration `production/api/migrations/0002_sync_revision.sql`
was applied to production on 21 September 2026 and must not be replayed manually.
From `production/api/`, apply only migrations shown as pending for the intended
remote database before deploying an API Worker that requires them:

```sh
npx --no-install wrangler d1 migrations apply SHOWTIME_DB --remote
```

Wrangler will show the migration list and request confirmation. Check the
Cloudflare account and database identity before accepting. Then deploy the API
and web Workers as one coordinated release, and verify the guest merge plus a
second device. A mixed old/new API and website may temporarily report a sync
error; local edits must remain usable. The 21 September 2026 sync revision
release is recorded in [the release record](verification/2026-09-21-account-sync-production.md).

```sh
npm run production:deploy:api
```

This deploys only `showtime-api`; it does not apply D1 migrations. After deployment, set the smoke targets in the same terminal and run:

```powershell
$env:SHOWTIME_API_URL='https://api.showtimetracker.show'
$env:SHOWTIME_FRONTEND_ORIGIN='https://showtimetracker.show'
npm --prefix production/web run smoke
```

The smoke suite sends the exact allowed production origin, checks the fixed public route table and confirms an explicit evil origin is denied. It never prints response bodies or credentials.

Also verify account endpoints, D1-backed sync and a safe email flow when those systems were affected.

## Monitoring and privacy

- Keep Worker invocation logging and retained request data to the minimum needed for operations.
- Logs must not contain authorization values, TMDB query values, request/response bodies, tokens or email reset/verification secrets.
- Treat D1 records and account email addresses as personal data.
- Check rate-limit behaviour and error rates after API changes.

## Versions and rollback

Before rollback, list versions from the owning package so the Worker target is unambiguous:

```sh
npm --prefix production/web run versions:list
npm --prefix production/api run versions:list
```

Select the reviewed version ID, then use the matching package:

```sh
npm --prefix production/web run rollback -- VERSION_ID
npm --prefix production/api run rollback -- VERSION_ID
```

After rollback, repeat the website checks or API smoke suite. Record the incident, version IDs and outcome without credentials or personal data.

A Worker rollback changes code only. It does not roll back D1 data, migrations, Resend activity or client-local state. If schema compatibility is uncertain, stop and assess data recovery before changing code versions.
