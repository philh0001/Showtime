# Home schedules and Account overview release — 21 September 2026

Website release `v1.1.3` addresses an iPhone report: saved South Park and Lanterns appeared in Watchlist, but Home showed their upcoming episodes only after opening each show. Home previously read a device-local schedule cache that was populated by the detail page. It now checks missing or day-old schedules for saved or actively tracked TV shows in the background, up to eight requests per visit with two concurrent requests. A failed check leaves existing results intact and offers a retry. Home still shows only shows with an announced upcoming episode, as requested by the owner.

The signed-in desktop header no longer says “Your library follows you.” The Account page now shows the signed-in email, verification and sync state, library counts from the current device, and links to Watchlist and viewing history.

## Verification

- `npm run check` passed: 4 repository structure tests, 65 local/shared tests, 126 client tests, 36 API service tests, 88 API Worker tests across 8 files, and 18 web tests. Typechecks, lint, web export, Worker dry runs, bundle checks, audits and credential scan completed. Lint reported one existing unused-disable warning and no errors; audits found 0 vulnerabilities.
- The new schedule tests passed for missing and stale shows, tracked shows, movies excluded, a failed fetch, retry cooldown, navigation abort, bounded concurrency and progress through a larger Watchlist.
- At a 390px iPhone-sized viewport, a fresh guest Watchlist with two TV shows and one movie caused exactly two mocked TV details requests. Both TV shows appeared under Upcoming Episodes without opening details; the schedule cache gained both records, Recently Viewed stayed untouched, and no horizontal overflow appeared. The check passed against both the local export and the deployed site.
- A desktop browser check used a mocked sign-up response and confirmed that the new Account overview was reachable from the header and that the old tagline was absent. The check passed against both the local export and deployed site. No real account or email was created.
- Only `showtime-web` was deployed. Cloudflare Worker version: `134de313-3ba7-4373-aabe-a6545741811a`. The API Worker and D1 were unchanged. Live `/` and `/account` returned HTTP 200 with the v1.1.3 bundle; the legacy Workers hostname still returned HTTP 301 preserving path and query.

## Remaining acceptance check

The owner should revisit Home on the same iPhone where the Watchlist shows South Park and Lanterns and confirm their announced future episodes appear without opening either title. Real iPhone schedule requests, email verification and account restore across Safari and the installed Home Screen app were not exercised by the mocked browser checks.
