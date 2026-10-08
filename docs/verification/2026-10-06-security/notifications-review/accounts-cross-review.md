# Independent account evidence cross-review

Read actual production `deployed/showtime-api-index.js`, especially lines 1266–1273, 1304–1312, 1422–1446, and 1721–1733. Ran `accounts-review/probe.mjs` unchanged: all assertions passed. No real credentials, database, email, or live API were used.

## Login versus password-reset revocation race

The proof exercises real deployed login verification/session resolution, with a controlled mock pausing the unconditional session insertion after old-password verification. It models reset completion by updating the mock user hash and clearing sessions. This accurately represents the effects of the deployed atomic reset batch: password_hash changes and existing sessions are deleted; a subsequent unconditional INSERT still succeeds. resolveSession checks expiry and existence, not a password/auth revision. A session issued by that in-flight old-password login therefore survives reset.

The race is real but prerequisites must be explicit: attacker already knows the old valid password; login must load/verify the old hash before reset commits, while INSERT must execute after reset commits. An attacker cannot normally suspend a D1 INSERT like the mock and cannot select reset timing. Concurrent repeated old-password login attempts around an anticipated victim reset can increase chances, subject to deployed AUTH_LIMITER and browser/API access. This is neither acceptance of an old password after completed reset in an ordinary sequential login nor password-reset-token bypass.

Medium severity is defensible as failed compromise recovery, given 30-day session lifetime and account data access; it should not be High without stronger practical evidence. The mock does not prove probability or an exploitable live timing window. Recommend auth/password generation stored with sessions and checked during resolution, or an atomic conditional insert based on the exact verified password hash with issuance failure on no changes. Merely deleting sessions inside the reset transaction or rechecking hash before an unconditional INSERT leaves a race.

## Other probe observations

Signup enumeration is explicit: registered email plus syntactically valid password receives 409 with an existence message. Low severity/privacy observation is reasonable, subject to product policy. Rate limits constrain enumeration but do not erase the response difference. The local proof deliberately chooses the existing-user branch and sends no email.

The sync tenant-key proof shows handleSyncPush binds the authenticated user's ID despite an injected userId. It confirms that specific tenant isolation behavior; it does not comprehensively prove every sync operation or collection safe. No isolation vulnerability is demonstrated by this probe.
