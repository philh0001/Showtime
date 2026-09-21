# Today-first Home release — 21 September 2026

Website release `v1.1.8` places dated episodes for saved TV shows under Today, This Week and Coming Soon, then shows a compact Your Watchlist strip. The Home schedule loads missing saved-show data without opening detail pages, retains known rows across temporary failures, and shows coverage and retry states. The supplied `showtimelogo.png` is used as one image so “TRACK · WATCH · DISCOVER” keeps its original alignment; the supplied 32-pixel favicon is also live. The release includes the existing v1.1.7 responsive Watchlist and v1.1.4 Profile/Account work.

## Verification and deployment

- The full `npm run check` gate passed after merging v1.1.6. After merging the newer live v1.1.7 Watchlist commit, `npm run production:check` passed: app lint/typecheck and 140 tests, shared/API checks, Worker tests, web export and 18 web tests, dry-run bundles, audits with zero reported vulnerabilities, and the bundle secret scan. App lint retained one existing unused-disable warning.
- The production account and required secret names were confirmed before deployment. No D1 migration was needed.
- API Worker `showtime-api` deployed as version `cc5ca6b7-63a7-4770-a29f-784c74f317f6`. The production smoke suite passed 10 routes. A live request to `/schedule/tv/1399` returned HTTP 200 with eight checked season records.
- Website Worker `showtime-web` deployed as version `ceae7a1d-4e90-4773-95dc-103419d37a37`. Live `/` and `/profile` returned HTTP 200. The served browser bundle contains `v1.1.8`, Today, This Week and schedule coverage copy. The live logo and favicon response bytes match the supplied files.
- Before release, local browser emulation checked the Home layout at 360px, 390px and 1440px, grouped episodes, navigation, cached and empty states, partial/error states and a 30-show cold queue. This did not include physical iPhone Safari or Android Chrome. No production account sign-in or cross-device restore was exercised for this release.
