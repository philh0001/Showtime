# Browser and deployed web review

Reviewed live production/UAT HTML, served entry assets, notification service workers and deployed web Worker bundles; old repository documentation provides context only. No live mutation, account creation, push, email or deployment performed.

## Confirmed: implicit cross-account library import (Medium, shared-browser prerequisite)

Production served bundle `prod.js:949` clears only account session on sign-out. `prod.js:955` supplies global collection storage keys to the sync engine. `prod.js:965` scopes only sync metadata by account ID and pushes global local collection data when the newly signed-in account has no corresponding cloud collection. `prod.js:1029` calls sign-out directly with no prompt or disclosure; no deployed account UI wording explaining retention/import was found.

Prerequisites: users A and B use the same browser profile/origin; A has local/synced data and signs out; B signs into a different account whose relevant cloud collection is empty. B receives A's local library and automatic sync copies it to B's cloud account. Existing B cloud data can also merge, but that branch was not reproduced here. This is distinct from deliberate guest-mode local retention: privacy impact is the automatic upload to another account without import consent.

Reproduction: `node docs/verification/2026-10-06-security/browser-review/reproduce-library.cjs`. This runs exact deployed sync and validation modules with synthetic storage and mocked cloud transport. PASS: A's synthetic watchlist is uploaded using B's synthetic session token. No live account test performed. Lock is replaced with a direct awaited callback because this test is sequential; merge dependency throws if called, proving empty-cloud branch independently.

Fix: use account-scoped collection storage, or track local-library ownership and require explicit import consent before merging another account's retained data. Clear/switch active local collections on logout/account transition while preserving an optional guest library separately. Ensure pending writes and sync generation checks preserve the chosen ownership policy.

Scope: confirmed deployed production bundle. UAT frontend also contains account/session and sync modules, but its web gateway intentionally rejects account routes; no claim that ordinary UAT login is functional.

## Verified controls / limitations

- Production and UAT HTML responses include restrictive script/connect CSP, frame denial, nosniff and permissions policy. UAT additionally sets noindex and no-referrer. Production permits only canonical API in connect-src; UAT permits same-origin only.
- Production legacy Worker host redirects to fixed canonical host while retaining path/query. A query `next=https://example.invalid` does not influence host.
- UAT bundle derives API from window origin `/api`; deployed UAT gateway allows only parsed content routes plus independent notification routes. Live GET `/api/auth/session` returns 404. CONTENT_API binding configuration was not independently reviewed by this subtask; content is intentionally fetched from production API per deployed gateway.
- Served production/UAT notification SW restricts push destinations to `/` or `/tv/<digits>` and uses notification text APIs. No fetch/cache handler exists.
- Backup export uses a collection whitelist and per-field allowlists; session and notification device credentials excluded (`prod.js:1016`). No backup import available.
- No confirmed app-controlled dangerous HTML sink found: inspected matches belong to React/framework/styles/Helmet. This is static coverage, not an exhaustive browser XSS proof.
- JS source-map path returns SPA HTML rather than exposed map. No credential patterns were printed or exposed; no full secret scan claimed.
- Bearer account sessions and notification device secrets are accessible to same-origin JS through localStorage. This is an XSS consequence/hardening concern, not evidence of an exploitable XSS.
- HSTS absent from sampled HTML responses: hardening item; no downgrade test performed.
- Same-origin retained library is visible to later browser-profile users even while signed out, an intentional behavior in old docs. The confirmed issue above focuses on silent cross-account cloud copy.
