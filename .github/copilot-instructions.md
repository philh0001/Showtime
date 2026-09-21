# Showtime repository instructions

Showtime is web-first. The live product is the Cloudflare-hosted website; native apps are only a possible later direction.

- `app/` is the shared Expo/React Native Web client.
- `shared/tmdb-api/` is the environment-neutral TMDB core.
- `production/` contains every deployable Cloudflare adapter and config.
- `local-uat/` contains local-only development and acceptance tooling.
- Never copy shared behaviour into both environments.
- Never import `production/` from `local-uat/`, or `local-uat/` from `production/`.
- Never deploy the local Node proxy.
- Preserve Worker names, routes, bindings, D1 identifiers, secret names, and the server-side credential boundary unless a reviewed design explicitly changes them.
- Use root package scripts so the target environment is visible.
- Run checks for every affected area and never claim a live deployment from a dry run.
- D1 migration `0002_sync_revision.sql` was applied to production on 21 September 2026. For future schema changes, inspect pending migrations and a recovery point before deploying the matching API Worker; coordinate dependent web releases and verify account sync.
- When paths, commands, environments, or deployment behaviour change, update the root README, owning environment README, current architecture/operations docs, this file, and `AGENTS.md` in the same commit.
- Files under `docs/superpowers/` and dated verification records are historical; do not rewrite them merely because current paths changed.
