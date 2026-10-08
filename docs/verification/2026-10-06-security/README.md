# Showtime deployed snapshots and security investigation

Captured on 6 October 2026 from the deployed production and UAT services, at the user's request. Open [report.html](report.html) locally for the full readable report. GitHub displays HTML as source; the findings below are readable directly here.

## Findings

| Severity | Finding | Verified scope |
| --- | --- | --- |
| Medium | An old-password login verified before reset can insert a surviving session after reset completes. Requires prior password knowledge and precise overlap; live timing probability untested. | Production API; conditional insertion present in UAT API bundle, where accounts are disabled. |
| Medium privacy design risk | A shared browser retains account A's library and silently uploads it into verified account B when its cloud collection is empty. Historical documentation specifies this behavior; runtime transfer consent is missing. | Production frontend. |
| Medium | Caller-selected new device credentials permit anonymous reservation of the small notification enrollment pool: 20 production devices, 4 UAT devices. | Both notification services. |

Additional observations: signup discloses existing account emails; malformed production push keys can strand the registering device's delivery; sampled HTML has no HSTS. UAT content proxy client-IP propagation remains an unverified runtime concern. The September GitHub lockfile triggers current dependency advisories, but current deployed dependency versions and reachability are not established.

Four independent domain reviews and peer cross-review informed these results. Controlled local proofs use synthetic data, mocked transport/database, and extracted deployed code. Three malformed production content API requests were rejected. No live account/device writes, production changes, migrations, load testing, real email or push occurred. These bounded results do not certify the application as secure.

## What these files are

- `deployed/`: all six captured, extracted Worker JavaScript modules plus SHA-256 manifest. Cloudflare module wrappers were removed without altering JavaScript. Line references in the report use these files.
- `browser-review/`: captured public production/UAT entry bundles, HTML, service workers, asset hashes and browser review.
- `evidence/current-deployments.json`: verified deployment versions and traffic percentages.
- The four `*-review/` directories: local proofs, results, findings and peer assessments.
- `evidence/github-app-dependency-audit.json`: current registry audit of the historical September lockfile, not an inventory of current deployed dependencies.

These compiled snapshots are recovery/audit references. They are not a runnable source restoration or a deployment package. Original October source, current lockfiles, tests, migration files and build provenance remain unavailable. Existing app/shared/production source is unchanged. No full asset export or recovery of original source maps is claimed.

AGENTS.md normally excludes generated bundles from commits. The user explicitly requested these deployed snapshots and audit evidence in a new PR; this dated archive is the limited authorized exception. Do not treat it as permission to commit ordinary build output or credentials elsewhere.

## Re-run controlled local evidence

From the repository root, with Node.js 24 (the tested runtime):

```sh
node docs/verification/2026-10-06-security/accounts-review/probe.mjs
node docs/verification/2026-10-06-security/browser-review/reproduce-library.cjs
node docs/verification/2026-10-06-security/notifications-review/proof.mjs
node docs/verification/2026-10-06-security/content-review/mock-pentests.mjs
node docs/verification/2026-10-06-security/content-review/uat-budget-test.mjs
```

These scripts run locally and do not intentionally contact real services. Cloudflare-specific header propagation, D1 runtime concurrency and practical live race timing are not established by Node mocks. Captured SQL verification results document a separate SQLite check. Raw HTTP response-header files are omitted from the public archive because they contain opaque telemetry metadata.

## Fix priorities

Recover matching source before implementation. Make session issuance conditional on the verified password hash, provide explicit account-library transfer/ownership handling, and control notification admission. Validate compatible dependency upgrades using current lockfiles and Expo compatibility checks. Any later release requires matching migrations, recovery evidence and environment-specific verification; this PR performs no deployment or migration.
