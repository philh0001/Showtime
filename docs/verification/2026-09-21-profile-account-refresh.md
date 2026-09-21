# Profile and Account refresh — 21 September 2026

Website release `v1.1.4` brings Profile closer to the visual direction in the owner's mockup: an identity header, compact viewing statistics, recent activity, a direct Watchlist link, and grouped Account, Settings, iPhone installation, and About sections. The Profile Account card now says what an account saves without claiming that every device is currently in sync. The Account sign-in, sign-up, password reset, and signed-in views use the same brand styling and clearer copy. The v1.1.3 Home schedules, account entry links, signed-in library overview, and iPhone help remain in place.

## Verification and deployment

- `npm run production:check` passed. App lint reported one existing unused-disable warning and no errors. Typechecks, app/API/web tests, web export, Worker dry runs, bundle checks, dependency audits, and credential scan completed.
- The live 390px Chrome Profile check found no horizontal overflow and confirmed that the iPhone installation steps expand and collapse. Live Account sign-in and sign-up views rendered at 390px without horizontal overflow; the sign-up screenshot showed the revised form and copy.
- Only `showtime-web` was deployed. Cloudflare Worker version: `26eed692-7ea8-4d65-b557-3cb254c0dc83`. The API Worker and D1 were unchanged.
- Live `/`, `/profile`, `/account`, and `/account?mode=sign-up` returned HTTP 200. The legacy Workers hostname returned HTTP 301 to the public Profile path with its query preserved. The live bundle contained v1.1.4, the revised Profile and Account text, and the canonical API URL.

## Remaining acceptance check

No real account credentials were available, so sign-in, verification, and account restore across devices were not exercised in the live browser. Existing automated account tests passed; the account sync acceptance check remains as recorded in the earlier release documents.
