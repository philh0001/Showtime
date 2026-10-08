# Deeper security investigation and controlled penetration tests

6 October 2026. Follow-up to the initial investigation in [README.md](README.md) and [report.html](report.html). The user requested independent agents, discussion/cross-review and a final controlled penetration-test pass. No application fixes, deployments or migrations were authorized or performed.

## Outcome

Four independent reviewers examined gaps in authentication, browser state, notification lifecycle and content/infrastructure boundaries. Each domain received a peer review from another domain reviewer. The coordinator independently reran all ten local evidence scripts spanning both investigation passes, and added account-body boundary tests and eight lightweight read-only live checks.

No additional independently exploitable remote vulnerability was demonstrated. The three initial Medium findings remain open:

1. Production login/reset session-issuance race; knowledge of the old password and precise overlap required.
2. Documented shared-browser library transfer into another account without runtime consent; verified new account and retained local data required.
3. Anonymous reservation of the notification enrollment pool in production/UAT.

Passing tests do not certify the sites as secure. Live account/device mutation, race probability, live D1 schema and Cloudflare-specific metadata behavior were deliberately not tested.

## Additional confirmed code behavior

### Malformed stored session expiry fails open — conditional hardening

Deployed production [showtime-api-index.js](deployed/showtime-api-index.js) line 1443 and UAT [showtime-uat-api-index.js](deployed/showtime-uat-api-index.js) line 1728 reject expiry through a Date timestamp comparison. Invalid stored text produces NaN, so the rejection condition does not fire. A local synthetic session with an invalid expiry resolved its user in both captured modules.

Prerequisites are malformed stored database data plus possession of that session's bearer token. Normal issuance writes ISO timestamps, and no reviewed external payload can choose expires_at. No affected live row or remotely reachable write primitive was demonstrated. UAT has no account database binding, so its auth code is latent rather than active account functionality.

Recommendation: require a finite parsed timestamp strictly greater than current time. Treat this as a code safety defect and database-integrity assumption, not a new Medium/High remote exploit on present evidence.

### Production has no verification-email resend route — recovery/availability gap

Production signup creates an initial 24-hour verification token and then sends email. Delivery failure is caught after account creation. Deployed production lines 1408–1417 and 1615–1649 show no resend route; login/reset do not issue another verification token. Failed/lost/expired initial verification can therefore leave a registered account unable to sync, and duplicate signup prevents recreating it normally.

This is a product recovery/availability issue, not an authorization bypass. UAT's captured API contains an authenticated cooldown-controlled resend implementation, but it is not exposed as a working UAT account service and has not been promoted to production. Recommendation: restore a rate-limited authenticated resend/recovery path through matching source and a separately reviewed release.

### Notification delivery lifecycle — reliability and defense in depth

Simulated successful provider acceptance records sent; explicit 429 records retry; ambiguous transport failure leaves claimed in both environments. Ambiguous dispatch outcomes are not automatically retried, reducing duplicate-delivery risk at the cost of missed alerts. Crashes after claim and before dispatch also warrant lease/recovery design.

Generation-unaware child cleanup/finalization and some delete predicates have stale-request weaknesses. No practical cross-user workflow enabling victim ID recreation under another token was demonstrated; existing victim IDs remain protected by credential checks. These remain hardening/reliability observations rather than newly confirmed cross-user vulnerabilities.

## Deeper test coverage

### Authentication and SQL

- Actual deployed reset and verification SQL executed in in-memory SQLite with historical schema/foreign keys: reset consumes sibling tokens, revokes existing sessions, preserves the other account, and rejects replay, wrong token type, invalid expiry and expiry equal to now.
- Handler checks reject malformed/reset-token alias payloads and deny unverified sync before database access. Payload-supplied userId/emailVerified cannot select another owner.
- Peer reviewer additionally checked sibling-token rejection, other-user password preservation and realistic fresh-salted-hash replay handling.
- Historical schema testing does not establish current D1 constraints or records. Ordinary random token/salt assumptions are explicit; privileged database corruption is not a demonstrated external attack path.

### Notifications and gateways

- Fifteen local observations passed using exact deployed modules, real local crypto, actual SQLite predicates and synthetic provider/schedule responses.
- Conflict-time ownership checks prevent stale PUT replacing another owner's record. UAT prevents endpoint duplication even when insertion occurs after precheck, and rejects stale subscription-fingerprint renewal.
- Repeated exact claim SQL cannot reclaim an already claimed event. This is sequential SQL safety verification, not a live two-dispatcher D1 experiment.
- Web gateways use fixed internal destinations, strict paths and selected headers; arbitrary Cookie/Origin headers are not forwarded. Query-bearing unsupported notification paths are rejected before upstream calls.
- Provider tests cover individual-message mode. Digest contention, real browser receipt, deadline behavior and crash recovery were not exhaustively exercised.

### Browser state and URL boundaries

- Exact compiled validators, trailer normalization and service-worker producer/click logic exercised locally in production/UAT captures.
- Stored posterUrl accepts arbitrary strings, but current img-src CSP blocks third-party tracking hosts; components use image APIs rather than application-controlled HTML. Normalize URLs as defense in depth. No attacker-to-victim write primitive or XSS was demonstrated.
- Extra JSON keys including own __proto__ are retained, but collection allowlists and tested code paths did not pollute Object.prototype. Field normalization remains sensible hardening.
- UAT account/sync/encoded routes are denied without upstream calls; accounts are disabled by both UI/gateway context and absent API database binding.
- Web Locks fallback, same-profile stale-tab state and persistence remain browser/runtime coverage limits; do not infer cross-browser isolation or a remote credential bypass.

### Content, cache and stream boundaries

- Eighteen local encoding rejection cases across production/UAT; ten accepted encoded query-data cases remain encoded data rather than changing upstream authority/path.
- Synthetic cache tests establish namespace separation and per-origin CORS reflection from a public cache entry. Static control flow rejects unapproved origins before cache access; account responses bypass public content caching.
- Oversize and stalled synthetic response streams are cancelled. The 4 MiB upstream bound is per response, not a total route/process memory guarantee; stalled-body tests do not prove arbitrary fetch implementations honor abort.
- TV optional failures make five distinct calls without retry loops. Failed transports still consume UAT work budget; exhausted budget cannot reopen further dispatch.
- Upstream error logs exclude synthetic token/response diagnostics in inspected paths.
- Parsing full JSON/text from Worker-owned caches and trusting the bound content response are defense-in-depth assumptions. No untrusted cache writer or binding replacement primitive was established. Stale-cache fallback and global/region limiter semantics were not comprehensively tested.

### Coordinator's final negative tests and live checks

Fourteen account-parser cases across the deployed API modules passed: oversized authentication body despite small declared Content-Length; multibyte UTF-8 byte limits; oversized sync envelope; oversized declared body; malformed JSON; negative declared length; ordinary small JSON acceptance.

Eight live requests used GET/OPTIONS only:

| Check | Observed result |
| --- | --- |
| Production API with unrelated Origin | 403 |
| Production API with Origin: null | 403 |
| Canonical frontend account preflight | 204, explicit canonical origin and Authorization header permitted |
| Production session without bearer token | 401 |
| UAT gateway account-session path | 404 |
| Production notification device OPTIONS | 405, PUT/DELETE only |
| UAT notification device OPTIONS | 405, GET/PATCH/PUT/DELETE only |
| Production /.env | 200 SPA HTML, not a configuration file |

No account verification GET was used because that route can modify state. No real account/device data, email or push was involved. Raw telemetry response headers are intentionally excluded from this public report.

## Evidence and limits

The initial proof scripts and captured code are archived in this PR. Expanded test scripts, results and four peer assessments are retained in the investigation workspace under deep-auth, deep-browser, deep-notifications, deep-content and deep-infrastructure; this public addendum summarizes them rather than claiming the expanded suite is fully archived here.

All ten initial/expanded local scripts exited zero on the coordinator's final run. Reviewers independently reran their peer's checks. SQLite checks use historical/inferred schemas and cannot establish live D1 schema, customer data integrity or Cloudflare concurrency. No load attacks, destructive requests, production writes, real emails/pushes, deployments, migrations or full authenticated remote pentest occurred.

Dependency applicability remains unresolved without current lockfiles/build provenance. Cloudflare service-binding client-IP synthesis, regional/global abuse limits, live race success probability and runtime-specific stream cancellation remain unverified. No additional Medium/High finding was assigned to these assumptions.

Priority remains recovering matching editable source, fixing the three initial Medium issues, adding fail-closed expiry validation and verification recovery, then validating a separate authorized release. This investigation did not fix the vulnerabilities.
