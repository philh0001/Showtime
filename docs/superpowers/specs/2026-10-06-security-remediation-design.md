# Showtime security remediation and source recovery design

Status: prepared for user review; implementation has not begun. This design follows the audited deployed snapshots and preserves the user's release/air-date tracker requirements. Production promotion remains a separate reviewed action after UAT verification.

## Intended result

Fix the three Medium findings (login/reset issuance race, implicit cross-account library transfer, anonymous notification pool reservation), add fail-closed session expiry and verification-email recovery, and preserve the current UAT product behavior. Preserve ratings, all tracked progress/history/settings collections, episode names/previous seasons, release updates/TBC, watchlist order, recommendations and dark/gold presentation. Guest operation and UAT's disabled accounts remain intact.

## Recovery facts and approach

Cloudflare's version/module reads expose compiled JavaScript only; no uploaded source maps were found for the six captured versions. The editable GitHub app is older and lacks current collections/features. The source files, lockfiles, migration scripts and complete asset manifests from the original workspace cannot be recovered faithfully through the available deployment API.

Preferred baseline is the latest original workspace/commit if it becomes available. Otherwise use narrowly reconstructed Worker source and a recovered Metro module overlay based on the captured UAT frontend. This is an explicit recovery fallback, not a claim to restore original TypeScript/React source. Do not rebuild/redeploy the old app as the current application. Do not use ad hoc minified-string substitutions or silently replace unrelated modules.

Backend: preserve exact captured Worker behavior as a readable recovered entrypoint before separating owned functions into maintainable modules. First prove baseline function/SQL behavior equivalence. Preserve current secrets, bindings, Worker names, service targets, compatibility settings, cache namespaces and environment boundaries; secret values are never retrieved or embedded.

Frontend: parse Metro factory definitions with an AST parser, record module IDs, dependency arrays, original factory bytes and expected exports, then store readable replacements only for owned modules that need changes. Reassembly without replacements must reproduce the captured bundle byte-for-byte. Replacement builds fail on baseline hash/module/export/dependency mismatch. Treat the runtime and unaffected factories as preserved recovery references, not ordinary source. Record provenance and keep original captured snapshots unchanged.

Captured UAT candidate modules include library-write-lock 783, AuthProvider 847, auth 848, account API 849, API base 850, stored session 851, restoration 852, session generation 853, sync adapter 854, collection validation 856, sync engine 866 and merge 867. IDs/exports are independently verified during implementation; production IDs differ and must never be substituted by assumption.

Recover and verify all assets required by the UAT routes under test, including logo/favicon/fonts/posters fallback, runtime-loaded app assets and existing report/screenshot URLs. The Cloudflare API does not expose a full asset-download manifest. If a complete deployable asset set or safe asset-preservation route cannot be established, prepare the locally verified PR and report the UAT rollout blocker instead of deploying an incomplete asset set. Source recovery is not permission to erase existing assets or reports.

All structural changes update root/owning READMEs, current operations guidance, AGENTS.md and copilot instructions. Recovered code is explicitly labelled; dated audit snapshots remain immutable.

## Authentication fixes

Create a session using one conditional INSERT SELECT against the exact user ID and password hash that was verified. If the insert returns no row, return generic login failure and no token. Do not use a separate hash recheck followed by unconditional INSERT. Use the already captured UAT conditional issuance as the reference, preserving production collection compatibility.

Session resolution must parse expiry, require a finite timestamp, and require timestamp strictly greater than now. Malformed/null/expired/equal expiry rejects authentication. Ordinary issuance remains ISO timestamps; no forced invalidation of valid existing sessions is required by this change.

Add authenticated verification resend with atomic cooldown reservation and retirement of prior verification tokens. Preserve non-enumerating behavior where appropriate, and never send real email in tests. Delivery failures retain a recoverable user-facing outcome. Review the captured UAT latent resend implementation, but do not expose account routes or attach a database to normal UAT.

Test conditional issuance against an intervening password reset, post-reset old-password rejection, fresh login acceptance, session revocation, token replay/scope/expiry and malformed expiry. Use actual SQL against synthetic copies of verified schema plus a local Worker/D1 runtime. UAT account functionality stays disabled: authentication end-to-end tests run against an isolated local account fixture, not production/customer accounts. Any future hosted account test environment requires separate configuration review.

## Browser library ownership and consent

Keep an explicitly identified guest library. An account's library must not be implicitly imported into a different account. Prefer account-scoped collection storage, with ownership/session-generation captured for each read/write/sync operation. On logout/account switch, cancel/invalidate pending operations, switch visible ownership, and recheck generation before applying a delayed result or issuing a cloud write.

All synced collections participate: watchlist, movie/TV progress, viewing activity, settings, TV/movie ratings, recommendation dismissals and notification preferences. Preserve distinct movie/TV keys and identities. Account-scoped sync baselines alone are insufficient: readers/writers, locks, notifications and backup/export must use the active library owner consistently.

Offer explicit guest-to-account import with accept/decline choices; consent is tied to that guest dataset and target account. Declining preserves the guest library separately and uses the account cloud library. Existing account-owned retained data is not offered as anonymous guest data to another account. Legacy unowned data is preserved and treated as ownership-unknown: ask which library to keep/import before any cloud upload, never infer another account's ownership from missing metadata. No automatic deletion to solve ambiguity.

UAT remains account-free. Exercise ownership transitions with synthetic local account/session fixtures and browser tests; preserve the actual deployed UAT guest experience. Verify A logout B, guest import accepted/declined, ownership-unknown data, reload, multi-tab operations and delayed pull/push completion. Add invitation-entry interaction tests using simulated subscriptions only.

## Notification admission

Recommended choice: operator-issued single-use invitation codes for new device enrollment. This protects the intentionally small pool without requiring an account or enabling UAT accounts. Existing enrolled devices continue to update preferences/subscriptions using their existing device credentials without an invitation. Do not automatically delete existing devices or revoke operators/users during remediation.

Generate 32 cryptographically random bytes per grant. Store only SHA-256 hash, fixed environment identity, issue time, bounded expiry and consumption metadata (device ID, device authentication hash, consumed timestamp). Issue plaintext once through a local operator command and document secure handling. No invitation in URLs, bundles, logs, analytics or persistent browser storage. The operator sends codes themselves; this task sends no messages to users.

New insert and grant consumption must be atomic with admission/capacity/ownership/endpoint predicates. D1 batch does not roll back a zero-row statement, so a conditional insert followed by unconditional consumption is prohibited. Implement guarded SQL bound to the uniquely successful insertion/operation, or a narrowly tested insert trigger that aborts invalid admission and consumes only a successful insert. Choose the simpler verified variant in the implementation plan. Only one distinct device may consume a grant. Capacity/validation/endpoint conflicts and failed inserts/transactions leave it usable.

Scope grants to the environment and database. Existing-ID updates must authenticate at commit time even if a preliminary read became stale. A lost-success-response retry succeeds as an authenticated update without consuming another grant. Deleted/cleaned-up registrations require a fresh grant for re-enrollment; consumption cannot resurrect them. Expired-but-present rows may follow authenticated PUT re-enable semantics, while PATCH continues to reject expired leases.

UI: first attempt authenticated existing-device update. Only structured admission_required prompts a new-device invitation. Distinguish invalid/expired invitation, capacity, endpoint collision and expired device status. Preserve an existing browser subscription after an enrollment failure. Explain that disabling/removing enrollment or losing browser credentials can require a new invitation. Avoid exposing backend details in ordinary product copy.

Preserve production's 20-device and UAT's 4-device caps, current distinct-show/schedule limits, provider host allowlists, manual/error redirect behavior and no-store gateway responses. Port cryptographic subscription validation and pre-dispatch error handling deliberately rather than promoting the whole UAT Worker blindly. No real push dispatch during verification.

Test actual SQL for two devices/one grant, last slot/two grants, same endpoint/two devices, same ID/different credentials, stale prechecks, rollback, zero-change insert, lost response retry, environment replay, expiry, authenticated grandfathered updates, deletion/re-enrollment and grant preservation after rejection. Simulated provider responses verify dispatch lifecycle; ambiguous provider acceptance is not browser delivery.

## Verified schema metadata and migration staging

Schema-only and d1_migrations-name reads on 6 October reported zero rows written and changed_db false; no customer records were read.

- Production accounts: 0001_accounts_and_sync.sql, 0002_sync_revision.sql and 0003_synced_preferences.sql applied. sync_state permits eight current collections but not movie-ratings. Token tables have created_at fields; additional staged record indexes are absent.
- Production notifications: 0001_notifications.sql applied. schedule_cursor lacks last_cleanup_at; devices_endpoint, delivery_created and registration_expiry indexes are absent.
- UAT notifications: 0001_notifications.sql and 0002_notification_lifecycle.sql applied. Cleanup column and all three listed indexes exist.

Reconstruct missing migration files from observed schema and intended change, label provenance, and stage them in source. Accounts movie-ratings needs a preserving CHECK/table rebuild; maintain rows, revisions, keys, foreign keys and existing collection values. Notification lifecycle must accommodate each observed starting state and investigate duplicate normalized endpoints before a unique index, without silently deleting rows. Admission table/index migration is new and environment-specific. Migration-number selection must follow recovered history, not guess it.

Run migrations against synthetic schema copies with representative records from every collection. No production migration is applied in this task. Before any UAT migration obtain private database recovery evidence and demonstrate a tested restore path; the user authorizes remediation/UAT work, not production promotion. Publish only sanitized verification summaries, never recovery/operator metadata, tokens or opaque telemetry artifacts.

## Verification and rollout gates

1. Establish reproducible recovery baseline; exact unchanged bundle reassembly and all existing audit proofs pass. Recover required asset set or block rollout explicitly.
2. Regression tests fail on the original vulnerability and pass with the fix. Run meaningful actual-SQL tests, local Worker runtime tests, existing owning-package checks and browser verification of preserved product flows.
3. Independent implementers/reviewers cross-check account, library and notification boundaries. Coordinator reruns evidence and identifies schema/runtime assumptions.
4. Capture private UAT recovery evidence. Apply only reviewed UAT-required migrations and deploy matching UAT services before its frontend. Preserve disabled accounts and separate service/database/cache/limiter boundaries. Do not deliver real email/push; controlled local transports cover delivery.
5. Run controlled UAT probes and browser regressions. Record exact versions/results and rollback evidence. Successful dry-run is not a deployment receipt.
6. Prepare a separate production promotion proposal with exact artifacts, pending migration list, recovery evidence, API-before-frontend order, notification compatibility and tests. Wait for explicit production release approval before production mutation/deployment.

## Review decision

Approve this recovery/remediation approach, including single-use invitations for new notification devices, or request changes. Approval permits writing the implementation plan; the brainstorming workflow then requires review of that written plan and execution method before architectural implementation. Prior task authorization remains intact; this gate concerns the newly concrete architecture/recovery choices, not a request to authorize the audit again.
