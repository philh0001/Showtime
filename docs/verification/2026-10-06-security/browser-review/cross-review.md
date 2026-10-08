# Independent notification peer assessment

Reviewed notification report and exact deployed handlers in `deployed/showtime-notifications-worker.js` and `showtime-uat-notifications-worker.js`, plus both deployed web gateways. Reran `notifications-review/proof.mjs` locally: production twenty registrations returned 200, next 503; UAT four returned 200, next 503; malformed key accepted only in production. No network calls or real DB writes were made.

## N1: retain Medium, scoped to global notification enrollment

Confirmed: production handler lines 445-480 accepts caller-selected device IDs/tokens, not account authorization or admission grants. Rate limit lines 466-471 is ten new registrations/IP/hour. Global pool is twenty devices per supplied verified production settings; four default in UAT. Production web gateway lines 9-29 forwards PUT device registration publicly; UAT gateway does likewise. Existing-device ownership checking prevents modifying others' IDs, but does not limit creation of new identities.

A caller can occupy all available enrollment slots over two IP/hour buckets in production, or four calls in one bucket in UAT. If legitimate devices already occupy some slots, only remaining slots must be reserved to block further enrollments. Attack does not evict existing devices or prove website downtime. Global show capacity can also refuse enrollment/update for other users, but the proof tests device capacity only. Scheduled read-budget pressure is plausible from code and bounded; do not overstate this as independently demonstrated dropped delivery.

Local mock faithfully establishes count/admission handler control flow but does not prove remote DB state, concurrency behavior or current free capacity. Deployed SQL enforces capacity independently of the pre-check, so the finding concerns lack of admission policy, not a race that exceeds capacity.

Correction to report prerequisites: UAT does not require a genuine provider-issued push subscription to enroll. Its crypto validation checks that a locally supplied P-256 point/auth decode and import, not that a provider issued the endpoint or that the caller owns it. The existing proof uses a freshly generated local key and fabricated FCM endpoint and receives 200. A later attempted delivery may remove fabricated endpoints on provider 404/410; immediate enrollment denial is proven, while indefinite UAT retention without successful subscription depends on no due event/provider response or continued renewal. Production malformed crypto fails before fetch, so provider cleanup cannot reclaim those records; 180-day age cleanup or operator remediation remains.

## H1: informational hardening, not separate security finding

Production accepts invalid curve keys, and scheduled encryption can throw after event claim without releasing it (production handler lines 576-599). Consequences are principally the registering device's own missed event; no cross-user takeover or confidentiality impact is demonstrated. Invalid keys materially ease N1 and retain fraudulent slots, but that belongs in N1. UAT strict curve validation and pre-send claim release are useful fixes to port.

## Fix assessment

Recommend an admission policy appropriate to a twenty-slot production pilot: verified account/invite or server-issued limited enrollment grants, per-principal device quotas, and short provisional leases with verified delivery/operational reclamation. Merely increasing IP throttling or validating crypto does not establish subscription legitimacy or prevent deliberate reservation of a tiny global pool. Preserve atomic global caps, because they bound resource spending.
