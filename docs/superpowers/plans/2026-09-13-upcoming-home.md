# Upcoming Home Implementation Plan

**Goal:** Add a local Upcoming Episodes section without per-title Home requests.
**Architecture:** Details updates a versioned schedule cache; Home joins cached
schedules to Watchlist and TV progress. Reuse the date-only episode selection.
**Tech Stack:** Expo 57, TypeScript, AsyncStorage, Node tests.
**Spec:** `docs/superpowers/specs/2026-09-13-upcoming-home-design.md`

## Tasks

- [ ] Add `tv-schedule-rules.ts` and `tests/tv-schedule.test.mjs`: test malformed
  storage, newest duplicate snapshots, non-past selection, membership, watched
  episode exclusion, and deterministic ordering before implementing the rules.
- [ ] Add `tv-schedule-storage.ts` with injected AsyncStorage interface: test
  failed reads/writes, preservation of unreadable storage, and concurrent writes.
  Implement a serialized read-modify-write queue under `showtime.tv-schedule.v1`.
- [ ] Bind the adapter in `tv-schedule.ts`; record successful TV details in
  `media-details-screen.tsx` without blocking its UI or altering watched state.
- [ ] Add `upcoming-section.tsx`: load on focus, show dated entries with detail
  links and last-checked labels, handle unavailable and empty states, and update
  the local calendar date while the focused screen stays open.
- [ ] Run all Node tests, lint, TypeScript, SDK checks and iOS export. Update the
  roadmap and verification notes with actual results and phone-test limitations.
