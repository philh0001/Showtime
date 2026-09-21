# Account sync production release — 21 September 2026

Source branch: `feature/cloudflare-api` at `0fa80fb`. The full `npm run check` gate passed before deployment. The existing production Resend API key secret and verification template configuration were present; no email configuration was changed.

The Cloudflare account was `67edaa36690dbf4aedaeec789690aac1`, and the intended D1 database was `showtime-db` (`26791329-ad1c-44f3-bcbd-c0340c979e41`). Before migration, `sync_state` had three rows and no revision column. The pre-migration D1 Time Travel bookmark was `00000017-00000000-000050ed-54cf02e57aae31066dfec00fcad39c6b`. Wrangler also reported capturing a backup when applying `0002_sync_revision.sql`. After migration, the same three rows had revision 1.

The API Worker `showtime-api` deployed as version `7630626e-b935-4d01-9b6a-a4b4332de19c` (previous listed version `76d2fe6f-48a8-4ba6-948b-a2779e2d710b`). The website Worker `showtime-web` deployed as version `d5a4fd4b-e96b-4045-be18-a09e9c4fa967` (previous listed version `090db7a1-feb3-4af4-8e62-cfd8dfcf69e8`).

The production API smoke suite passed all 10 routes. `https://showtimetracker.show/profile` returned HTTP 200, and the homepage served the newly uploaded `entry-a36745b165f57012191adeb260b4c375.js` bundle. The legacy Worker URL `/search?q=batman` returned HTTP 301 to `https://showtimetracker.show/search?q=batman`. The unauthenticated `/auth/session` request returned HTTP 401 as expected.

No production account credentials or controlled test account were available, so a real guest registration, email verification and second-device library restore were not exercised against production. The Resend secret's presence was verified, but no live email was sent. The automated client and Worker integration tests cover the merge and revision behavior. A browser acceptance check with a controlled account remains the release's outstanding proof.
