# Cloudflare API-First Design

Date: 14 September 2026
Status: Approved for implementation planning

## Plain-Language Summary

Showtime currently asks a small Node server on the development computer to
contact TMDB. The first Cloudflare phase moves that server responsibility to a
Cloudflare Worker. Search, discovery and title details will then work without
the development computer being switched on.

The Worker is a guarded doorway, not a database. It receives a small set of
validated Showtime requests, contacts fixed TMDB endpoints with a secret token,
and returns only the fields Showtime understands. Watchlists, viewing progress,
history and settings remain on the user's device and never pass through the
Worker.

The API will be deployed first. Hosting the Expo Web/PWA is a separate follow-up
milestone after the API has been proven independently.

## Goals

- Host the existing `/search`, `/discovery` and `/details/*` API behavior on a
  Cloudflare-provided `workers.dev` address.
- Remove the public client's dependency on the development computer and home
  network.
- Keep the TMDB Read Access Token exclusively in server-side secret storage.
- Preserve the current response contracts and local Node development workflow.
- Treat security, abuse resistance, observability and rollback as release gates.
- Remain suitable for Cloudflare's free plan during early real-world use.

## Non-Goals

- Hosting the Expo Web/PWA in this milestone.
- Accounts, authentication, cloud backup or cross-device synchronisation.
- Sending personal viewing data to Cloudflare or TMDB.
- A custom domain, native App Store distribution or push notifications.
- Hiding a public API behind a secret embedded in the Expo application.

## Architecture

The existing route behavior will be split into runtime-neutral core handlers and
thin runtime adapters:

```text
Expo Go / local web / future hosted web
                  |
                  v
       EXPO_PUBLIC_SEARCH_API_URL
                  |
          +-------+-------+
          |               |
          v               v
 local Node adapter   Cloudflare Worker adapter
          |               |
          +-------+-------+
                  |
                  v
     shared search/discovery/details core
                  |
                  v
                 TMDB
```

The shared core owns routing decisions, input validation, upstream URL
construction, TMDB response validation and safe error mapping. Adapters only
translate their runtime's request and response types and provide dependencies
such as the TMDB token, `fetch`, logging, timeouts, caching and rate limiting.

The local Node server remains available on port 3001. Production clients select
the Worker through the existing `EXPO_PUBLIC_SEARCH_API_URL` setting. No TMDB
credential is introduced into an `EXPO_PUBLIC_` variable.

## API Surface

The initial Worker exposes only:

- `GET /search?query=<title>`
- `GET /discovery`
- `GET /details/movie/<positive-id>`
- `GET /details/tv/<positive-id>`
- `GET /details/tv/<positive-id>/season/<positive-season-number>`
- `GET /details/person/<positive-id>`
- `OPTIONS` only where required for an allowed browser-origin preflight

Unknown paths return `404`. A recognized route containing an invalid ID or
season number retains the existing `400` contract. Unsupported methods return
`405`; request bodies are not accepted. Search input remains trimmed and
limited to 1-100 characters. IDs and season numbers must be canonical positive
integers, and the complete request URL is limited to 2,048 bytes before route
handling. `/search` accepts exactly one `query` parameter; every other route
accepts none. Unknown or repeated parameters are rejected.

Response bodies retain the existing restricted Showtime shapes. Raw TMDB
payloads, response headers and error bodies are never forwarded.

## Security Model

### Protected assets and trust boundaries

The protected server-side asset is the TMDB token. The Worker handles public
film and television metadata only. Persistent user data stays in local storage
and is outside the Worker boundary.

The primary threats are:

- credential exposure through source, client bundles, responses or logs;
- account or deployment-token compromise;
- automated request abuse and upstream quota exhaustion;
- open-proxy or server-side request forgery behavior;
- malformed, oversized or deliberately expensive input;
- accidental data leakage through errors and observability;
- compromised or malicious build dependencies and deployment tooling;
- unsafe cross-origin browser access; and
- a defective deployment becoming the client's only API.

### Required controls before first deployment

1. The Cloudflare account must use a verified email address and multi-factor
   authentication. Recovery codes must be stored securely. Deployment tokens
   must use the least privileges and shortest practical lifetime.
2. `TMDB_READ_ACCESS_TOKEN` must be configured with Cloudflare encrypted Worker
   secrets. Local Worker development may use `.dev.vars`, which must be ignored
   by Git. Secrets must never appear in Wrangler configuration, committed files,
   command arguments, logs, screenshots or generated Expo output.
   `.dev.vars*` and `.env*` ignore rules must be committed before either file is
   created. Wrangler configuration declares `TMDB_READ_ACCESS_TOKEN` under
   `secrets.required`, causing development and deployment to reject a missing
   binding without storing its value in configuration.
3. Every upstream URL must be created by server code from a fixed
   `https://api.themoviedb.org` base and validated route values. Callers can
   never supply an upstream host, protocol or complete URL.
4. Route, method, query, path, ID, season and total URL-length validation occurs
   before rate-expensive work or an upstream request.
5. TMDB requests retain bounded timeouts. Optional detail requests remain
   failure-isolated so one slow optional resource cannot exhaust the whole
   response budget. Fetch uses `redirect: 'error'`, rejects an oversized
   `Content-Length`, and aborts streamed reads beyond 4 MiB before JSON parsing.
6. Responses use safe, stable errors and attach at least
   `Content-Type: application/json; charset=utf-8`,
   `X-Content-Type-Options: nosniff`, and `Referrer-Policy: no-referrer`.
   Error responses use `Cache-Control: no-store`.
7. Production CORS uses an explicit configured origin allowlist. Localhost
   origins belong only to local development. Requests without an `Origin`
   header remain possible for native clients, so CORS is browser hygiene rather
   than authentication.
8. The API has no client-side shared secret. Any value bundled into Expo could
   be extracted and would provide only the appearance of access control.
9. Cloudflare automatic invocation logs must be disabled because their default
   request URL includes search query text. Sanitized custom events contain only
   route template, response status, duration, cache outcome and opaque request
   identifier. They exclude the URL, TMDB token, authorization headers,
   upstream bodies and full search text.
10. Wrangler configuration must explicitly set
    `observability.logs.invocation_logs` to `false`; relying on a dashboard
    default is not acceptable.
11. A source and generated-bundle credential scan must pass before deployment.
12. Wrangler explicitly disables public version previews with
    `preview_urls: false`. Only the intended production `workers.dev` route is
    exposed.
13. Wrangler limits each invocation to at most eight external subrequests. The
    free-plan CPU ceiling is recorded and verified against real details
    responses before client cutover.
14. Worker dependencies are kept minimal, pinned through the committed lockfile
    and reviewed before installation. Dependency provenance, install scripts,
    known vulnerabilities and the final bundled dependency tree are checked
    before deployment. Automated update tools may propose changes but never
    deploy them without tests and human review.

### Abuse controls

Rate limiting occurs before TMDB calls and is stricter for details routes, which
can make several upstream requests. The initial per-client, per-route-category
limits are 30 searches, 30 discovery requests and 20 details requests per
minute. A second budget caps estimated TMDB work at 100 units per client per
minute: search, season and person cost one unit, discovery costs two, movie
details reserve four, and TV details reserve five. Anonymous clients cannot be
identified reliably; an IP-derived client key is therefore best-effort abuse
mitigation, not identity or exact accounting. These limits are documented in
Wrangler configuration and covered by tests. Rate-limit responses use `429`
with a safe retry message, and upstream TMDB `429` rates are monitored.

Successful public metadata is cached through Cloudflare's Worker caching layer
to reduce upstream load:

- discovery: up to 30 minutes;
- ordinary title/person/season details: 10 minutes;
- search: no shared edge caching initially, avoiding retention of search terms;
- errors and malformed responses: never cached.

Cache keys are constructed only from the validated canonical route and query.
The core response schema is validated before a response enters the cache.
Module-level memory caching remains useful to the local Node adapter but is not
considered a production cache because Worker isolates do not share durable
process memory. Cache behavior must be tested in the local Workers runtime and
confirmed on the deployed `workers.dev` endpoint.

Cached payloads contain no origin-specific CORS header. After cache retrieval,
the adapter clones the response and attaches the exact allowed origin plus
`Vary: Origin`; this prevents a response prepared for one website from granting
access to another.

Cloudflare's limiter is permissive and eventually consistent, so monitoring and
the ability to disable or tighten expensive routes remain necessary. Rate
limiting is not treated as precise quota accounting.

### Search privacy decision

`/search` remains a `GET` endpoint for the first API release to preserve the
existing client contract and the semantics of a read-only lookup. Search
responses are never cached, full URLs are excluded from custom logs, and
Cloudflare invocation logs are explicitly disabled. A sentinel query verifies
those controls on the deployed Worker.

Changing search to `POST` would reduce the chance of query text entering
URL-oriented infrastructure, but it would not hide the request body from the
service processing it and would expand this migration's client and validation
surface. Reconsider `POST` before wider public use if real usage or privacy
requirements make search terms sensitive.

## Error Handling

The Worker keeps the current distinction between invalid requests, missing
routes, unsupported methods, upstream throttling, missing configuration and
temporary upstream failures. Public responses contain no stack traces,
filenames, environment values or upstream response bodies.

Every response receives an opaque `X-Request-ID` generated inside the Worker,
and the same identifier is included in server logs. A caller-provided request ID
is never reflected or trusted. The identifier contains no encoded request or
user information. Logging failures must not prevent a safe response.

## Configuration

Committed configuration contains only non-secret values such as Worker name,
compatibility date, route limits and binding names. Environment boundaries are
explicit:

- local Node: `mobile/.env.local`;
- local Wrangler: ignored `.dev.vars`;
- production Worker: encrypted Cloudflare secret;
- client: public Worker base URL only.

Wrangler and Cloudflare Worker type dependencies are pinned through the existing
package lock. Production and local configuration must not silently fall back to
one another.

## Account Ownership and Recovery

The user owns the Cloudflare account, its verified email address, MFA factors
and recovery codes. Recovery codes are stored outside the repository in a
trusted password manager or equivalent secure location. At least one recovery
method must be tested before production secrets are added.

Wrangler authentication on a development computer must not be treated as the
only recovery path. Active Cloudflare sessions and deployment tokens are
reviewed after initial setup and after any suspected device compromise. Lost
account access, an unavailable MFA factor or missing recovery codes blocks
deployment; it must never be bypassed by placing account credentials or broad
API tokens in repository files.

The runbook records how to revoke local Wrangler access, rotate a deployment
token, rotate the TMDB token and regain access through Cloudflare's supported
account-recovery process. It records locations and responsible ownership, never
secret values or recovery codes.

## Testing Strategy

Implementation follows test-driven development. Existing Node contract tests
remain the baseline and must exercise the shared core rather than a duplicated
Worker implementation.

Worker-specific automated tests cover:

- every allowed route and all rejected paths/methods;
- invalid, encoded, oversized and traversal-like inputs;
- fixed-origin upstream URL construction;
- CORS allow, deny, absent-origin and preflight behavior;
- security and cache headers on success and every error class;
- timeout, TMDB throttling, malformed upstream data and network failure;
- rejected TMDB redirects, declared oversized bodies and streams exceeding the
  4 MiB parsing limit;
- rate-limit allow and reject paths without contacting TMDB after rejection;
- Worker-cache hit, miss, expiry and exclusion of errors/search terms;
- response-schema preservation between Node and Worker adapters; and
- deliberate token-shaped canaries proving secrets never enter responses or
  logs.

Verification before deployment includes TypeScript, ESLint, the complete test
suite, Wrangler's local runtime, a dependency/security review and credential
scans of source plus generated Expo output.

## Mandatory No-Go Conditions

A deployment or client cutover stops immediately when any of these is true:

- a TMDB token, token-shaped canary, authorization header, complete search URL
  or sentinel search phrase appears in a client bundle, response or retained
  log;
- automatic invocation logs or public version-preview URLs are enabled;
- required-secret validation, request limits, rate limiting, fixed-origin fetch
  enforcement, redirect rejection or the 4 MiB body limit is absent or failing;
- CORS reflects an unapproved origin, omits `Vary: Origin`, or is stored inside
  a shared cached payload;
- contract, adversarial, type, lint, dependency or credential-scan checks fail;
- the hosted smoke test cannot exercise every supported route and safe failure
  class;
- the last known-good deployment cannot be identified and restored in a real
  rollback drill;
- Cloudflare account recovery and MFA have not been secured; or
- monitoring shows unexplained Worker `5xx`, CPU-limit failures, TMDB `429`
  responses or quota growth that has not been investigated.

No deadline or convenience exception overrides these conditions. Resolve the
failure, repeat the relevant checks, and record new evidence before proceeding.

## Deployment Sequence

1. Build and verify the shared core and both adapters locally.
2. Create the Cloudflare account, verify its email, enable MFA, and store its
   recovery codes securely. Test one supported recovery path.
3. Authenticate Wrangler using a least-privilege deployment flow.
4. Create the Worker on the free plan with its generated `workers.dev` host.
5. Confirm public version previews are disabled and required-secret validation
   is active.
6. Add the TMDB token interactively as a Worker secret.
7. Deploy without changing any client configuration.
8. Run route, error, header, CORS, rate-limit and credential-leak smoke checks
   against the hosted URL.
9. Confirm invocation logs are disabled, then issue a unique sentinel search
   and verify its text is absent from stored logs, live logs and tracing
   metadata. Inspect sanitized custom events for the expected route template,
   status, duration and opaque request ID.
10. Configure one development client with the hosted public base URL and test
   Search, Discover, movie, TV, season, person and provider flows.
11. Verify from mobile data with the development computer switched off.
12. Perform and verify a real rollback, redeploy the approved version, and
    record its version identifier.
13. Only then make the hosted URL the documented production API endpoint.

Account creation and deployment require the user's direct Cloudflare login.
Implementation and local verification do not.

## Rollback and Incident Response

Before client cutover, record the last known-good Worker deployment identifier
and preserve the local Node path. If a deployment fails its smoke tests, roll
back the Worker before changing clients. If a problem appears after client
cutover, restore the last known-good deployment or temporarily point development
clients back at the local server.

If token exposure is suspected:

1. disable or roll back the affected Worker;
2. revoke and rotate the TMDB token;
3. replace the Cloudflare secret;
4. revoke questionable Cloudflare sessions and deployment tokens;
5. inspect sanitized logs and repository history for the exposure path;
6. repeat credential scans and security tests; and
7. redeploy only after the cause is corrected.

Operational monitoring covers Worker quota consumption, CPU-limit failures,
Worker `5xx` responses, upstream TMDB `429` responses and cache hit rate. The
runbook defines warning and action thresholds after baseline traffic is observed;
early testing inspects these signals after every deployment.

The operational runbook must record exact deployment, smoke-test, rollback and
rotation commands before the first production release.

## Documentation Deliverables

- Keep `docs/DEPLOYMENT-AND-DISTRIBUTION.md` as the high-level release strategy.
- Keep `docs/ROADMAP.md` as the phase checklist.
- Treat this document as the approved API architecture and security model.
- Add a Cloudflare operations runbook during implementation, before deployment.
- Record dated verification evidence after the first successful hosted test.

## Success Criteria

The API-first milestone is complete only when:

- the hosted Worker preserves every supported API response contract;
- the TMDB token appears only in approved secret stores;
- required security and adversarial tests pass;
- abuse controls, safe logging and rollback are operational;
- an Expo client works against the Worker over mobile data;
- the development computer can be switched off without breaking TMDB features;
  and
- no personal Showtime data is sent to the Worker.

## References

- [Cloudflare Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- [Wrangler configuration and required secrets](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Cloudflare Workers Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Cloudflare Workers caching](https://developers.cloudflare.com/workers/cache/configuration/)
- [Cloudflare Workers logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
- [Cloudflare Worker preview URLs](https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare account two-factor authentication](https://developers.cloudflare.com/fundamentals/user-profiles/2fa/)
- [Cloudflare Worker security headers](https://developers.cloudflare.com/workers/examples/security-headers/)
