# Independent content API / infrastructure review

Scope: complete deployed production API, UAT API, production web, UAT web; historic repository contract and production wrangler config. Repository source is older than deployed code; deployed bundle evidence takes precedence. No deployment, migration, account request, email, push, database mutation, valid live content fetch, load test or credential output performed.

## Result

No confirmed exploitable content API vulnerability found in reviewed scope. SSRF, query injection, shared-cache poisoning and unbounded schedule fanout were not reproduced. This is bounded verification, not a guarantee of absence.

Controls observed in deployed production API:
- Canonical positive safe integer IDs; rejects extraneous/duplicate queries, overlong URLs/searches, encoded nonnumeric IDs and traversal. Public options validate route before succeeding.
- Upstream origin fixed to https://api.themoviedb.org, path confined to /3/, explicit dot-segment/control/backslash checks, manual redirects. Credential-bearing redirects rejected.
- Maximum upstream JSON body 4 MiB; stream and fetch abort timeouts.
- Search uncached; public content cache keys derive from validated route, not client headers/host; CORS applied after cache retrieval; no account data in public cache.
- TV schedule reserves at most 13 calls, selects at most 12 seasons and runs at most three season requests in parallel. Returned episode cap 200. Temporary schedule gaps not cached.
- Cache hits still category-limited, uncached work subject to work limit. UAT code additionally admits each upstream call serially and closes its budget on denial.
- UAT gateway only accepts recognized GET content routes, uses bound content Worker, removes arbitrary request headers, uses manual redirects and no-store client responses. Production web does not proxy public content API.

## Unconfirmed availability concern (UAT only)

Deployed UAT web worker line 206 constructs content service requests with only Accept. Incoming CF-Connecting-IP is discarded in local mock execution. UAT API line 2034 selects CF-Connecting-IP or literal anonymous as the limiter key. Two distinct mocked client IPs both produced requests carrying only Accept. If runtime does not synthesize distinct client metadata on this service binding, all gateway users share the anonymous category/work limiter buckets; one caller could consume capacity for everyone. Same-zone Cloudflare subrequest metadata semantics can affect this conclusion, so this is NOT a confirmed deployed vulnerability and no live saturation was attempted. Recommendation: verify service binding metadata in an isolated deployed fixture, then preserve a trusted client key if needed. Do not blindly accept a browser-supplied forwarding header.

## Controlled pentests and evidence

`mock-pentests.mjs`: 9 malformed route cases; 5 invalid external/traversal endpoints rejected before fetch; mocked 302 credential-bearing upstream redirect rejected; 100-season fixture dispatched 12 season requests with concurrency exactly 3; two mocked UAT client IPs lost their CF-Connecting-IP header.

`uat-budget-test.mjs`: 13 concurrent reservation attempts with a limiter allowing only two caused exactly two upstream dispatches; subsequent work closed and failed. UAT SSRF endpoint and duplicate-query checks passed.

`live-probes.json`: exactly 3 network requests, all to production content API: GET /details/tv/0, GET /search?query=x&query=y, OPTIONS /details/tv/0. Each returned 400 with expected generic validation body. These malformed routes terminate before upstream dispatch and are not cached. No UAT live probes and no account verification GET (which could mutate state).

## Limits

Rate-limit bindings/configured deployed values are owned by parent's configuration review; historical wrangler settings do not establish deployed binding presence. Did not perform edge saturation, worker runtime metadata fixture, upstream availability degradation, DNS/TLS tampering or cross-region limiter experiments. Shared in-memory request coalescing and rate limiting are not global distributed guarantees; no design-specific abuse confirmed. Local tests execute extracted deployed JavaScript in Node, which cannot establish Cloudflare-specific service-binding header behavior.
