# Deployed notification security review

Reviewed complete deployed multipart bundles. Production version `24e9738e-7a69-49f9-b9fd-a244b46dddca`; UAT `c7c89b47-efb5-454b-8dd0-9f11b5d624dc`. References below use exact multipart line numbers, including its four-line MIME prefix. No deployment, real DB queries, push delivery, email, or live mutations occurred.

## N1 — Medium: anonymous callers can reserve the entire notification capacity

**Confirmed code behavior in both environments; live exploitation not attempted.** Production `showtime-notifications.multipart:449-483`, capacity defaults/max at `406-411`; UAT `showtime-uat-notifications.multipart:487-545`, expiry at `476`, cleanup `569-584`.

The device credential is caller-selected rather than an existing account, invite, or issued registration grant. An unauthenticated caller chooses a fresh 32-hex device ID and 64-hex token and registers a valid subscription. Verified Cloudflare settings configure production for twenty devices, sixty distinct shows, and seven schedule reads; UAT has no overrides and defaults to four devices, twenty-four shows, and four reads. The code cannot exceed twenty devices. The only registration gate allows ten attempts per IP/hour. Twenty accepted records in production (four in UAT) deny every subsequent legitimate registration with 503. Production requires two IP/hour buckets at ten registrations each, or one IP across two hourly windows; UAT needs four registrations within one bucket. Registrations remain for 180 days; PUT with the attacker's device credentials can refresh them indefinitely. Distinct-show limits can alternatively be filled with arbitrary positive show IDs.

Prerequisites: public web route forwards notification PUT to this service (parent reviewing route exposure); attacker can register own genuine Web Push subscriptions in UAT. No victim credential or subscription is needed. Production also accepts invalid curve keys, making a successful push subscription unnecessary there.

Impact: denial of notification enrollment and consumption of the small scheduled delivery/schedule-read allocation. This does not establish broader website downtime or private-data access.

Reproduction: `node docs/verification/2026-10-06-security/notifications-review/proof.mjs`. It imports exact deployed code extracted unchanged from MIME; an explicitly mocked DB controls count/upsert. With verified settings, production returns twenty 200 responses then 503; UAT returns four 200 responses then 503. The proof explicitly resets its mocked counter after ten calls to model a distinct IP/hour bucket, not a rate-limit bypass. Zero network requests occur. The mock demonstrates handler control flow; it is not a remote binding or SQLite concurrency test. SQL also enforces the same cap atomically.

Fix: require an account/invite or server-issued limited admission capability when global capacity is intentionally this small; apply per-principal quotas and expiration/reclamation. An IP-only limit greater than the entire pool does not prevent this attack. Preserve atomic DB admission bounds. Consider short provisional leases until successful delivery and a monitored operational recovery path.

## H1 — Informational reliability hardening, production only: malformed push keys accepted and delivery permanently claimed

**Confirmed acceptance; consequence established directly from deployed control flow.** Production `showtime-notifications.multipart:352-359` validates only key string lengths; registration at `468`; cryptographic parsing at `129-145`; delivery claim at `550-559`; encryption/send at `582-589`; catch at `601-603`.

A key of 87 `A` characters and auth of 22 `A` characters passes production validation although it is not a valid uncompressed P-256 public key. The local proof receives 200 for this input in production, versus 400 in UAT. When an event becomes due, encryption imports this invalid point and throws before fetch; catch increments failure but leaves the delivery in `claimed`. Eligibility selects only `pending`/`retry`, so that event cannot be sent again even if the same device later supplies working keys. Invalid records can occupy the scarce global enrollment slots without any functioning subscription.

Prerequisites: anonymous enrollment or ownership of a device credential. Impact principally affects the attacker's own notification registration and assists N1; no cross-user ownership bypass shown. Exclude as a standalone security finding: the stranded delivery affects the registering owner only, and scarce capacity abuse is already covered by N1.

Fix: port UAT `validSubscriptionCrypto` (`370-383`) into production and its pre-send failure release (`760-765`). Preserve ambiguous post-dispatch failure handling to avoid duplicate pushes. UAT addresses invalid-curve-key acceptance and safely releases pre-send failures.

## Controls verified from code

- Both versions allow only HTTPS exact hostnames `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `web.push.apple.com`; reject userinfo and non-default ports, and use `redirect:"error"` on dispatch. No arbitrary-host SSRF demonstrated. Production URL normalization/hash acceptance is a hardening difference, not an allowlist bypass.
- Device token must be 64 lowercase hex characters; stored credential is SHA-256, not plaintext. Existing ID updates require matching hash, including conflict-time SQL checks. Caller-controlled subscriptions/preferences are plaintext DB records by design; no secret leak in logs seen. Token issuance and browser credential storage require client review, outside these two bundles.
- UAT rejects duplicate normalized endpoints using pre-check, atomic insert predicate, and handling of the `devices_endpoint` uniqueness constraint. Production lacks endpoint uniqueness; duplicate registrations require possession of the subscription material and primarily create duplicate delivery/resource use.
- Request body is limited to 12 KB and five seconds; preferences cap shows at thirty and validate timezone. Scheduled work caps devices at twenty, unique shows at sixty, schedule reads at ten, four individual show messages/device/run or one digest, bounded dispatch timeouts and a 240-second deadline. Global schedule work is bounded.
- UAT GET/PATCH device status/renewal require device credential and matching subscription fingerprint; PATCH cannot renew expired devices and renewal is throttled to thirty days. Captured device bearer credentials remain replayable by design until removal/expiry; no independent replay vulnerability established.
- Production DELETE authenticates in one query but later deletes by ID only (`461-464`); UAT guards device deletion by hash (`497`) but child rows are ID-only. A concurrent delete/recreation of the same randomly generated ID could affect its replacement. No practical attacker route to induce replacement ownership was established; retain as race hardening rather than a confirmed exploitable issue.

## Test artifacts

`proof.mjs` performs only local mocked handler calls. Extracted `showtime-notifications.mjs` and `showtime-uat-notifications.mjs` contain deployed module code for reproducibility. Test passed on Node v24.19.0. No real endpoints or credentials are contained in the fixture.
