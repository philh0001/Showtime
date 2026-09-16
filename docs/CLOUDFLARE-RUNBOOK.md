# Cloudflare Worker Operations Runbook

This runbook is an operational gate, not a substitute for account security.
Stop on any failed check, secret or sentinel leak, unexpected 5xx, unsafe
header, quota/CPU error, or failed rollback.

## Pre-deployment gate

From `mobile/`, export the web output immediately before scanning:

```powershell
npx expo export --platform web
npm run worker:release-check
```

The release check must pass without waivers. It includes mobile lint/typecheck,
tests, Worker checks, a dry-run bundle, dependency audit, and credential scans.

## Account and first deployment

Before authenticating, verify the Cloudflare email, enable MFA, store recovery
codes securely, and test a supported recovery path.

```powershell
npx wrangler login
npx wrangler whoami
npx wrangler secret put TMDB_READ_ACCESS_TOKEN
npx wrangler deploy
$env:SHOWTIME_API_URL='https://showtime-api.<account-subdomain>.workers.dev'
npm run worker:smoke
npx wrangler deployments list
```

Replace the hostname with the exact Wrangler output. Enter the TMDB token only
at the interactive secret prompt; never put it in a command, file, log, or
screenshot. Confirm `preview_urls: false` and disabled invocation logging in
the Cloudflare dashboard.

## Privacy and monitoring checks

Run a unique sentinel search through the hosted endpoint, then inspect Workers
Logs, live logs, and traces. The sentinel, query text, full URL, token, caller
headers, and upstream bodies must be absent. Custom events may contain only the
documented request ID, route, status, duration, and cache outcome.

Monitor Worker CPU/quota, 5xx responses, TMDB 429s, cache effectiveness, and
rate-limit rejections. Stop and investigate any unexpected signal.

## Rollback and recovery

Record the approved deployment version ID without recording secrets:

```powershell
npx wrangler deployments list
npx wrangler rollback <KNOWN_GOOD_VERSION_ID>
npx wrangler deployments list
npm run worker:smoke
npx wrangler deploy
```

Replace the version ID from Wrangler output. Confirm the approved version is
restored after the drill. Review active sessions and tokens, revoke unused
access, and rotate `TMDB_READ_ACCESS_TOKEN` through the interactive secret
prompt if compromise is suspected. Never record token values or recovery codes.
