# Phase 7 UI and Design Polish

Approved in chat on 14 September 2026. Showtime will use a compact,
tracker-focused design with automatic light and dark modes.

## Goals

- Make personal progress easier to scan than promotional content.
- Use space well on iPhone, tablet and desktop without crowding small screens.
- Give light and dark modes equal first-class support through the device setting.
- Simplify TV tracking while preserving every current action and storage rule.
- Improve consistency and accessibility without adding UI dependencies.

Brand assets, watch-provider data and physical-iPhone verification remain
separate roadmap items.

## Visual direction

Showtime should feel like a personal viewing journal rather than a streaming
service storefront. The interface stays restrained: neutral surfaces, strong
type hierarchy, poster artwork, and one accessible accent colour for progress,
selection and success. Light mode uses a soft off-white background rather than
pure white; dark mode keeps the existing near-black character.

The app follows the operating-system colour scheme. A manual theme selector is
not included in this increment.

## Shared foundations

Create semantic theme tokens for background, elevated surface, subtle surface,
primary and secondary text, border, accent, on-accent text, danger and pressed
states. Components consume these tokens instead of hard-coded screen colours.
Expo Router headers, native tabs and web tabs use the active scheme too.

Use shared layout values for page padding, section spacing, corner radii and
content widths. Main content is centred on wide screens. Interactive controls
retain at least a 44-point target and visible keyboard focus on web.

## Responsive composition

Phone layouts remain one column. Sparse collections use full-width compact rows
for one or two items; larger collections keep horizontal poster rails. Tablet
and desktop layouts arrange independent Home modules in two columns where that
improves scanning, while poster-heavy discovery can span the full width. The
layout must respond to available width rather than platform name.

## Home

Keep the existing information order and data loading behavior. Tighten the
header, search action and section spacing into a clear dashboard. Personal
sections use compact cards when sparse and rails when populated. Upcoming rows
show title, countdown and episode identity first; cache metadata is quieter.
Wide layouts use a balanced module grid so short collections do not leave large
unused regions.

## TV tracking and details

The latest season remains first and visually primary. Its summary, progress and
bulk action appear together. Long episode lists start collapsed behind a clear
`Show episodes` control and preserve individual watched controls when expanded.
Older seasons use compact rows with status and one action; Specials remain
visible and explicitly untracked.

Movie and TV details use the same data and actions as today. On wider screens,
artwork and primary actions form a summary column while overview, tracking and
extras form the content column. Phones retain a single readable flow.

## Watchlist and Profile

Watchlist becomes a responsive poster grid when space permits and retains a
compact list treatment at narrow widths. Filters remain visible, progress stays
attached to each title, and removal remains a secondary action protected from
accidental taps.

Profile statistics become a compact responsive grid. Navigation, Settings and
About become distinct labelled groups instead of one continuous list.

## States and accessibility

Loading, empty, unavailable and retry states use the same card and copy patterns
across screens. Both themes must meet readable contrast, preserve dynamic text
wrapping, expose selected/expanded/busy states to assistive technology and avoid
using colour as the only status signal. Web controls need visible hover and
keyboard-focus feedback.

## Scope and sequencing

1. Semantic light/dark theme and shared layout foundations.
2. Home responsive composition and reusable cards.
3. TV tracking simplification and responsive details.
4. Watchlist and Profile restructuring.
5. Cross-screen accessibility and consistency review.

Each increment keeps current storage, networking and navigation semantics.
There are no new runtime dependencies, accounts, hosted services or data-model
changes.

## Verification

Each increment requires focused rule/component tests where behavior changes,
then the full automated suite, lint, TypeScript, Expo dependency validation and
web/iOS exports. Browser QA covers light and dark schemes at phone, tablet and
desktop widths, keyboard navigation, sparse and populated collections, and
loading/error/empty states. Phase 6 and Phase 7 physical-iPhone verification
remain incomplete until performed on the device.
