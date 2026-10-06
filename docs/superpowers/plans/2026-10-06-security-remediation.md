# Showtime Security Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps below use checkbox syntax. Independent agents implement bounded tasks; separate reviewers check each deliverable and the combined branch.

**Goal:** Reconstruct a reproducible current-code baseline, fix the audited security findings, verify safely on UAT where possible, and prepare a separate production promotion.

**Architecture:** Preserve captured Worker behavior and the current Metro runtime/unaffected factories. Maintain audited recovered factory overlays and environment-specific manifests; put new security logic in owned source modules with synthetic fixtures and provenance. Keep ordinary UAT accounts disabled and all production mutations outside this implementation.

**Tech Stack:** Node.js 24 (available/tested), JavaScript ES modules, pinned Acorn 8.15.0 for AST parsing, SQLite for SQL tests, Cloudflare local Worker/D1 runtime, Playwright for browser checks. Use existing compatible Wrangler tooling; do not force an Expo major upgrade.

**Spec:** `docs/superpowers/specs/2026-10-06-security-remediation-design.md` (approved by user on 6 October 2026).

## Global Constraints

- Production promotion is a separate explicitly approved operation; no production deployments/migrations/customer writes here.
- Preserve Worker names, secrets/bindings, services, compatibility settings, cache/limiter/environment boundaries and current product behavior.
- Preserve UAT disabled accounts; use an isolated local account backend for authentication/browser account-transition tests.
- Never print existing secrets or issue real email/push; invitation tests use synthetic codes only.
- Do not reconstruct original TypeScript/comments/lockfiles by assertion; label recovered source and provenance.
- Fail deployment preparation if the asset set/preservation route or recovery proof is incomplete.
- Never silently delete user/device/library data to make migrations or ownership transfer work.
- Root scripts identify targets. Update root/owning READMEs, current operations guidance, AGENTS.md and copilot instructions for structural changes.

## Review Focus

1. Captured bundle mismatch or wrong environment/module IDs: builds must fail closed before replacement.
2. Legacy ownership-unknown data and late sync results: preserve data, require an ownership decision, prevent application/upload under another account.
3. Zero-row admission insert and concurrent replay: no grant consumption without the uniquely successful enrollment.
4. Old production versus newer UAT notification schemas: preserving migrations must work from both observed baselines; duplicate endpoints must be reported rather than removed.
5. Incomplete assets/recovery evidence or latent UAT auth: local success must not be misreported as deployability or remote account verification.

## Task 1: Recover a reproducible baseline

**Files:** Create `scripts/recovery/package.json`, its lockfile, `scripts/recovery/metro-bundle.mjs`, `scripts/recovery/metro-bundle.test.mjs`, `app/recovery/{production,uat}/manifest.json`, `production/recovery/{api,uat-api,notifications,uat-notifications,web,uat}/worker.mjs`, and `production/recovery/README.md`. Modify `package.json` and required current guidance. Original snapshots remain under dated verification docs unchanged.

**Interfaces:** `parseMetroBundle(source: string): {segments: Array<{start:number,end:number,id:number|null,dependencies:number[],bytes:string}>}`; `reassembleMetroBundle(parsed, replacements: Map<number,string>): string`; manifest includes environment, captured SHA256, expected IDs/dependency arrays/exports and source provenance. Workers export their original default entrypoint. `recovery:check` runs recovery integrity tests and existing audit controls.

- [ ] Write tests for exact no-edit reassembly of both captured bundles; reject changed hash, duplicate factory ID, changed dependencies and missing expected exports. Prove all nonreplacement byte ranges unchanged.
- [ ] Run tests and record failure before parser/reassembly implementation.
- [ ] Implement AST extraction and guarded reassembly with Acorn ranges, never regex replacement of minified product code. Preserve source bytes independently of AST formatting. Recover readable Worker entrypoints without behavior changes and record hashes.
- [ ] Recover live-safe plain configuration/binding names and required public assets. Store no secret values/operator recovery metadata. Inventory current report/screenshot URLs and runtime assets separately. Establish a complete asset set or verified preservation method; otherwise mark the rollout gate blocked while completing local fixes.
- [ ] Run integrity/audit tests, local Worker baseline tests and repository boundary checks. Review recovery provenance, docs and generated-artifact exceptions. Commit baseline separately from behavior fixes.

## Task 2: Atomic login, finite expiry and verification recovery

**Files:** Create owned helpers under `production/recovery/security/auth-session.mjs`, recovered auth adapter modules, `production/recovery/test/auth-security.test.mjs` and SQLite/local-D1 fixtures. Recover staged account index migration source after confirmed applied history; do not apply it remotely.

**Interfaces:** `createSessionForPassword(db, {id,userId,passwordHash,tokenHash,deviceLabel,expiresAt}): Promise<boolean>` performs one INSERT SELECT with id/hash predicate and RETURNING; `validSessionExpiry(value, now): boolean` requires finite timestamp strictly greater than now. Resend route is authenticated `POST /auth/resend-verification`, with atomic cooldown reservation/retirement as in captured UAT latent code; normal UAT does not expose it.

- [ ] Add a real-SQL regression that verifies old hash, commits reset, then attempts session issuance; vulnerable baseline admits it and fixed implementation must reject it. Add fresh login, expired/equal/malformed/null expiry, sibling-token replay, other-user isolation and unverified-sync cases.
- [ ] Run the new tests against baseline and record expected failures.
- [ ] Implement conditional issuance and finite expiry in owned recovered auth modules; preserve generic failure and public response compatibility. Implement resend cooldown/old-token retirement and mocked delivery/recovery responses.
- [ ] Execute actual SQL against synthetic copies of verified schema, then local Worker/D1 request tests. Verify normal UAT continues to deny account routes and has no accounts database binding. Review/commit auth fix.

## Task 3: Single-use notification admission and preserving migrations

**Files:** Create `production/recovery/security/notification-admission.mjs`, recovered notification adapters, `production/notifications/migrations/0003_notification_admission.sql`, reconstructed historical `0001_notifications.sql`/`0002_notification_lifecycle.sql`, `production/recovery/test/notification-admission.test.mjs`, `scripts/notifications/issue-invitation.mjs` and operator guidance. Stage production lifecycle prerequisites without applying them.

**Interfaces:** Payload optionally carries `invitationCode`; new enrollment uses `notification_admissions` with hash, environment, finite expiry, issuance and consumed device/auth/time. Add nullable `devices.enrollment_nonce`; existing records retain null. New enrollment uses a fresh random operation nonce. Device upsert gates new insertion on an unused valid environment grant and preserves existing enrollment_nonce on authenticated updates. In the same D1 batch, consume only the matching grant with EXISTS(device id/auth/enrollment_nonce = this operation); zero-change/rejected inserts cannot satisfy that predicate. Preserve existing commit-time ownership/capacity/show/endpoint predicates. Prove transaction semantics rather than trusting prechecks.

**Admission policy:** Missing grant -> 403 `admission_required`; invalid/expired/replayed/wrong-environment grant -> 403 `admission_invalid`; capacity -> 503; endpoint collision -> 409. Existing authenticated updates require no invitation. Deleted registrations require a fresh grant. Default invitation expiry 24 hours, maximum seven days; reject nonfinite/overlong lifetimes. Use independent database/environment grants, not a stateless HMAC capability.

- [ ] Write failing actual-SQL admission tests: two devices/one grant, last slot/two grants, same endpoint/different ID, same ID/different auth, stale read, transaction rollback, zero-row insert, lost response retry, wrong environment, expiration, rejected validation/capacity and post-deletion replay. Seed grandfathered records and prove their updates need no grant.
- [ ] Implement migration and guarded admission batch; verify consumed nonce belongs only to the successfully inserted row. Any unexpected consume mismatch must fail tests and block rollout. Test alternative duplicate-key operations and transaction failure; do not rely on D1 batch rolling back zero-row statements.
- [ ] Reconstruct lifecycle schema migration from observed metadata. Run preserving upgrades from both production and UAT starting schemas with synthetic records. Report normalized duplicate endpoints before uniqueness migration; never silently drop records. No remote application yet.
- [ ] Implement invitation issuer: generate random 32-byte code, prepare hash-only issuance data, write plaintext once to an explicit private 0600 operator file outside tracked paths; logs show no code. Do not run real issuance/network delivery during tests.
- [ ] Port production crypto validation/pre-send failure handling deliberately and verify provider allowlist, cleanup, claims and simulated outcomes. Review/commit migrations/admission; preserve caps 20 production / 4 UAT and existing device credentials.

## Task 4: Account-owned libraries and invitation UI

**Files:** Create `app/recovery/security/library-ownership.mjs`, `app/recovery/security/library-ownership.test.mjs`, owned Metro replacement factories/registry for auth/provider/storage/sync/account UI and notification UI, and browser fixtures. IDs/dependencies come from Task 1 manifests, not guessed source paths.

**Interfaces:** `libraryKey(owner, collection): string`; `transitionLibrary({from,to,generation,decision}): Promise<void>` under the library write lock; operation context captures owner/session/generation and exposes `isCurrent()`. All nine supported collection identities use the active owner, including distinct movie and TV ratings. Consent has dataset identity + target account scope. The guest library is separate; legacy unowned data is preserved behind a decision before any cloud upload.

- [ ] Add failing baseline synthetic tests for A logout B cloud upload and late pull/write application. Add guest accept/decline, legacy ownership unknown, reload, per-collection isolation, lock ordering and multi-tab generation invalidation.
- [ ] Implement ownership transitions and consistent storage/reader/writer wrappers. Recheck generation before applying async results or dispatching writes; switching invalidates old operations. Preserve voluntarily imported guest data and account cloud restore. Do not represent A's data as guest for B.
- [ ] Add concise accept/decline ownership/import UI using captured presentation conventions. Ordinary UAT remains account-free; local fixture alone enables account transition UI with isolated backend.
- [ ] Add notification invitation input only after structured admission-required response; preserve functioning subscriptions on error and keep code transient. Cover missing/invalid/expired/capacity/conflict/removal/cleared credentials without technical implementation detail in product copy.
- [ ] Run AST/byte-range invariants and browser checks for ratings persistence, watchlist removal/Undo, release messaging/TBC, progress/history, recommendations, phone/desktop layout and focus-only skip link. Review/commit UI and ownership fixes.

## Task 5: Combined controlled tests and UAT gates

**Files:** Create `production/recovery/test/security-regression.test.mjs`, browser QA records under dated verification, root explicit recovery/UAT scripts and private ignored recovery evidence locations. Reconstruct missing movie-ratings migration source and test it with every existing sync collection; do not apply to production.

- [ ] Run all regression/actual-SQL/local Worker/browser tests and relevant existing package gates. Distinguish unavailable old source gates or runtime assumptions from verified current recovery tests. No test fixture may contact real email/push providers.
- [ ] Independent reviewers cross-review combined code and migrations; coordinator reruns proofs against original and fixed code, confirming expected red/green behavior and no unrelated product regressions.
- [ ] Recheck current UAT versions/schema without customer reads; obtain private recovery evidence and a tested restore procedure. Verify assets/preservation route and build isolation. Block deployment if either proof is incomplete.
- [ ] Only when gates pass: reviewed UAT-required migrations, matching UAT services, then frontend. Keep accounts disabled and separate services/databases/caches/limiters; record actual receipts. Do not mistake dry-run for live deployment.
- [ ] Run bounded read-only UAT security/browser checks and simulated local subscription/account fixture tests. Do not fill real device pools or send pushes/emails. Record remaining remote concurrency/header/receipt limitations.

## Task 6: Reviewable GitHub delivery and production proposal

**Files:** Update draft PR #2 title/body around final implemented scope; append dated verification record with exact fixed artifact hashes, tests, UAT receipts or blockers, and production promotion checklist. No public recovery/operator metadata.

- [ ] Publish reviewed source/migrations/tests with provenance, sanitized evidence and documentation. Verify remote tree matches local reviewed contents; preserve old workspace work and keep main unchanged until merge is authorized.
- [ ] Prepare exact production pending migration order, private recovery evidence checklist, API-before-frontend release order, notification compatibility, rollback strategy and post-release checks. Do not deploy production or apply its migrations.
- [ ] Report what is implemented, what has been proved locally/UAT, outstanding blockers, and which initial findings remain live in production. Request production approval only after a concrete release is prepared and verified.

## Plan review and execution

Use independent implementation/review agents as the user requested, with the coordinator integrating and verifying evidence. Task 1 precedes runtime changes; Tasks 2/3 can proceed independently after their shared baseline/schema interfaces are verified; Task 4 depends on stable library/admission contracts; Tasks 5/6 follow integration. User review of this written plan is the remaining workflow gate before implementation, not renewed authorization for the already approved task.
