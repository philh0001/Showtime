# Library sync design

This document describes the implementation released from the `feature/cloudflare-api` worktree on 21 September 2026. Showtime keeps guest mode and the existing email/password account system on the Cloudflare API Worker. D1 remains the account database; no Supabase project or client secret is needed.

## Data boundary

The five synced collections are Watchlist, watched movies, TV progress, viewing activity and the `showTrending` setting. They remain local AsyncStorage values and one JSON snapshot per account and collection in D1. TMDB supplies media metadata; the sync database stores only the user's library state and the small title snapshots already used locally. Recent searches, Recently Viewed and schedule caches remain device-local.

The Worker authenticates each sync request from the bearer session and uses the resolved user ID for every D1 query. Browser clients never send a user ID to choose a D1 row. Guest mode makes no sync requests.

## First login and later merges

On the first sync for an account on a device, distinct local and cloud records are combined by identity. Watchlist identity is media type plus TMDB ID; movie progress uses movie ID; TV progress uses show ID, season number and episode number. A clean device copies cloud state locally. The merged result is written locally and conditionally pushed to D1.

Each device stores its last successful snapshot under an account-scoped sync metadata key. Later syncs compare that base with the current local and cloud snapshots. A change on only one side wins. Different titles and different episodes changed on separate devices are combined. A deletion or explicit unwatch since the base removes that item when the other side left it unchanged. A missing local collection key is treated as uninitialized or evicted storage and is restored from the cloud; a missing or `null` cloud snapshot is rebuilt from the saved local collection. Saved empty arrays represent deliberate removal of all records. The Worker reports malformed cloud JSON as an error instead of hiding the row. When both sides change the same item concurrently, a deletion wins; conflicting scalar values prefer the local value, except movie `watchedAt` prefers the later timestamp. Existing TV progress has no per-action timestamps, so simultaneous opposite actions on the same episode cannot be ordered reliably; the deletion rule is deterministic. This is a known limit for a later per-action timestamp migration.

Viewing history events receive stable IDs on new writes. Older events receive deterministic IDs during a merge, and the merged sequence numbers are rebuilt so two devices' local sequence counters cannot discard an event. Stored events without IDs still load.

## Stale writes and failures

Migration `production/api/migrations/0002_sync_revision.sql` adds a `revision` column, initially 1 for existing rows. A push includes the revision the device last pulled, or `null` when it saw no row. D1 updates or inserts only when that expectation still holds. On HTTP 409 the client pulls, merges and retries. Older clients without a revision receive HTTP 428, preventing them from bypassing the guard.

Local edits save immediately and request a debounced sync when a verified account is active. The mobile-first website refreshes account verification and sync when its tab or Add to Home Screen window becomes visible or focused; the native `AppState` path remains for compatibility. Login and the manual Sync button also request sync. A cloud failure leaves local values available, returns an error to the account screen and retries on a later edit, resume or manual request. A saved session remains locally usable during a temporary network outage. Malformed local collections are preserved and block that collection's sync rather than being treated as empty. A successful cloud pull notifies visible library screens to reload.

Signing out revokes the session and retains the current local library, as specified for guest mode. Signing into a different account on the same browser will merge that retained local library into the new account. Users should clear browser site data before sharing a device if they do not want that transfer; a dedicated account-switch/clear-local-data flow is outside this change.

## Release order and proof

The production release applied `0002_sync_revision.sql` to the verified D1 database, with a Time Travel recovery bookmark captured beforehand and a Wrangler backup captured during migration. The API Worker and web Worker were then deployed. The full repository check and production route smoke suite passed, and the live website, account route and legacy redirect responded as expected. Automated integration tests cover account isolation, guest-to-account merge, a second device, offline edits, explicit unwatch and errors. A real browser/account check across two devices remains outstanding because there is no hosted UAT environment or controlled test account in this repository. A code rollback cannot remove the added D1 column or undo data writes. See the [release record](verification/2026-09-21-account-sync-production.md).
