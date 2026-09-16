# Deployment and Distribution

## Goals

Showtime's first public release should be easy to try from a normal URL, keep
the TMDB credential outside every browser and mobile bundle, and remain
effectively free to operate while usage stays within the relevant free tiers.
It should not require an account, a custom domain, TestFlight or an App Store
installation.

The Cloudflare API and web frontend described below are deployed. Physical
device, persistence, installability and broader public-release checks remain.

## Current Development Architecture

The verified development architecture remains:

```text
Expo Go / browser
        |
        v
Showtime
        |
        v
local Node server
        |
        v
TMDB
```

The Node server on the development PC keeps the TMDB credential out of the
Expo client. TMDB-powered features depend on that server and are not yet
independently available over the public internet.

## Production Architecture

The planned production architecture is separate from the local setup:

```text
Showtime Web/PWA
Future native client if required
        |
        v
Cloudflare Worker API
        |
        v
TMDB
```

Cloudflare is the production host. Azure remains useful as a general learning
platform but is not required for Showtime.

Deployment, smoke testing, rollback, secret rotation and incident response are
defined in [`CLOUDFLARE-RUNBOOK.md`](CLOUDFLARE-RUNBOOK.md). The runbook is
mandatory before any hosted endpoint or client cutover is used.

## Cloudflare Hosting

The API/proxy runs as a Cloudflare Worker and the Expo single-page web output is
deployed with Workers Static Assets. The production endpoints are:

- Web: `https://showtime-web.showtime-workers.workers.dev`
- API: `https://showtime-api.showtime-workers.workers.dev`

Relevant current guidance:

- [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Single-page application routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)

Both Workers use checked-in Wrangler configuration. The generated frontend
bundle contains the public API URL but no TMDB credential.

## Production API

The production API preserves the local proxy's trust boundary for public
traffic. It:

- adapts the required TMDB proxy routes to the Cloudflare Workers runtime;
- stores the TMDB token as a Worker secret, never as plaintext client or
  committed configuration;
- gives the Web/PWA and any later native client an explicit production endpoint;
- returns production-safe errors without leaking credentials or internals;
- applies suitable origin, request-validation and abuse controls;
- adds proportionate logging and monitoring without recording secrets;
- scans source and generated client output for credentials; and
- still requires verification of Search, Details and discovery over mobile data
  and with the development PC switched off.

The current local server is for private development and must not be exposed or
deployed as-is.

The Worker `ALLOWED_ORIGINS` value is the exact HTTPS origin of the deployed
Showtime web frontend. It is not the API origin, a wildcard, or a placeholder.

## Web/PWA Distribution

The Web/PWA is the first planned public-distribution route:

```text
User receives URL
      |
      v
opens Showtime
      |
      v
uses it immediately
      |
      v
optionally adds it to their iPhone Home Screen
```

The release should use a Cloudflare-provided hostname initially. Cloudflare
provides `workers.dev` hostnames for getting started without first adding a
custom domain. A custom domain can be considered later if the project becomes
public-facing or important enough to justify one; it is not an initial release
requirement. See Cloudflare's current guidance for
[`workers.dev`](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
and [routing options](https://developers.cloudflare.com/workers/configuration/routing/).

Before public sharing, verify the production URL in iPhone Safari and supported
desktop browsers, including navigation, responsive layouts, API failures,
reloads, restarts and reasonable offline/error behaviour.

## Persistent Local User Data

The first public Web/PWA release remains guest-first and local-first. Watchlist,
watched movies, watched seasons and episodes, TV progress, Continue Watching,
viewing history and settings are persistent user data. They must not be treated
as disposable network cache data.

```text
TMDB/API responses, posters and temporary network data
        |
        v
cache where useful

Watchlist, progress, history and preferences
        |
        v
persistent browser/device storage
```

The browser implementation may use a different storage mechanism from native
AsyncStorage, but it must preserve the same user-facing expectation: if a user
adds a show, closes Safari and later returns on the same browser and device, the
show remains. Storage choices and migrations must be evaluated during Phase 8;
this document does not select or implement them.

### Local storage limitations

Guest/local data:

- does not automatically follow the user to another browser or device;
- may be removed if the user clears browser or site data;
- is not a cloud backup; and
- may be subject to browser/platform storage policies.

These limitations are acceptable for the initial release and should be stated
clearly in the product.

## iPhone Add to Home Screen

The intended optional iPhone experience is:

1. Open Showtime in Safari.
2. Use **Add to Home Screen**.
3. Launch Showtime from its own icon.
4. Use the app-like standalone presentation where the browser and platform
   support it.

A PWA is not identical to a native iOS application. Its Home Screen icon and
standalone presentation are part of the web strategy. A true native widget,
such as one showing upcoming episodes, would require native work and remains a
possible much-later feature.

## Future Accounts and Cloud Sync

Accounts are not a gate for public use. They should be considered only after a
Web/PWA release has real users who demonstrate a need for cloud backup,
cross-device progress, or synchronised Watchlists, history and settings.

```text
Guest/local mode
       +
optional account
       |
       v
cloud backup and synchronisation
```

No authentication or database provider is selected. Provider evaluation,
account design, migration, conflict handling and privacy requirements belong to
Phase 9 if that phase proves worthwhile.

## TMDB Credential Security

The TMDB Read Access Token must remain server-side. It must never be placed in
an `EXPO_PUBLIC_` variable, web bundle, native application bundle, committed
file, log or screenshot. Cloudflare documents encrypted Worker secrets for API
tokens and other sensitive values; production implementation should follow the
then-current [Workers secrets guidance](https://developers.cloudflare.com/workers/configuration/secrets/).

The release checklist must include a credential scan of source and generated
web/native output. Browser clients should receive only the restricted response
fields required by Showtime.

## Cost Strategy

The early release should remain effectively free to operate while traffic and
resource use stay within the relevant free tiers. Do not build decisions around
hard-coded price or quota figures: review Cloudflare and any other service's
current terms immediately before implementation and again before public launch.
A custom domain and paid services are optional later decisions.

## Release Phases

```text
Current local development
        |
        v
Finish product/UI polish and physical-device QA
        |
        v
Cloudflare-hosted production API
        |
        v
Cloudflare-hosted Web/PWA
        |
        v
Guest/local persistent storage
        |
        v
Share Showtime through a normal URL
        |
        v
Optional Add to Home Screen on iPhone
        |
        v
Gather real-user feedback
        |
        v
Optional accounts/cloud sync later
        |
        v
Native App Store version only if worthwhile
```

The detailed implementation and verification checklists remain in the
[roadmap](ROADMAP.md).

## Future Native iOS Distribution

Native distribution becomes a decision after the Web/PWA has users:

```text
Successful Web/PWA
        |
        v
real users
        |
        v
decide native adds enough value
        |
        v
Apple Developer membership
        |
        v
Expo/EAS production build
        |
        v
TestFlight
        |
        v
App Store
```

Apple Developer membership, TestFlight and App Store Connect are not current
requirements. A native version should proceed only if it adds enough value over
the PWA, for example through platform integrations that matter to users.

## Out of Scope for the Initial Web Release

- mandatory signup or authentication;
- cloud backup or cross-device synchronisation;
- selecting an authentication/database provider;
- a custom domain;
- TestFlight or App Store distribution;
- a native iOS widget; and
- treating local user state as disposable cache data.
