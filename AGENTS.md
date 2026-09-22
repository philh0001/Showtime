# Showtime development instructions

## Repository contract

Showtime is a web-first movie and TV tracking application. The live product is the Cloudflare-hosted website at `https://showtimetracker.show`; native apps are only a possible later direction.

Before editing, classify the change as shared app, shared TMDB core, production, or local/UAT:

- Shared UI, routes, state and product behaviour belong in `app/`.
- Environment-neutral TMDB parsing and handlers belong in `shared/tmdb-api/`.
- Deployable files, Cloudflare configuration and release tooling belong in `production/`.
- Local-only servers and QA tooling belong in `local-uat/`.
- Cross-environment behaviour belongs in `app/` or `shared/` and is never duplicated.

`production/` must not import `local-uat/`, and `local-uat/` must not import `production/`. The local Node proxy is never deployed. The website and browser workflow are primary; preserve inexpensive native compatibility without making native distribution part of routine releases.

## Change discipline

- Work incrementally and keep changes focused.
- Preserve Worker names, routes, custom domains, bindings, D1 identifiers, secret names and the server-side TMDB credential boundary unless an approved design explicitly changes them.
- Use root package scripts so the target environment is visible.
- Avoid copying code between production and local/UAT; extract genuinely shared behaviour instead.
- Do not commit secrets, local environment files, generated bundles, dependency directories or temporary evidence.
- Do not treat a dry-run bundle as proof of a remote deployment or remote binding health.
- D1 migration `0002_sync_revision.sql` was applied to production on 21 September 2026. For future schema changes, inspect pending migrations and a recovery point before deploying the matching API Worker; coordinate dependent web releases and verify account sync.
- Do not push directly to `main` during feature work.

## Verification

Run the narrowest relevant tests while developing, then the owning package gate:

- Shared client: `npm run app:check`
- Shared TMDB and local adapter: `npm run local:test`
- Boundaries and root tooling: `npm run test:structure`
- Production API and website: `npm run production:check`
- Whole repository: `npm run check`

For visual changes, also verify the current browser layout and important routes. iOS or Android export/testing is a secondary compatibility check when a change touches native behaviour.

## Documentation is part of every structural change

Any path, command, environment, or deployment change must update `README.md`, the owning environment README, affected current docs, `AGENTS.md`, and `.github/copilot-instructions.md` in the same change.

Files under `docs/superpowers/` and dated verification records are historical. Do not rewrite them merely because current paths changed; current guidance lives in the files listed above.
