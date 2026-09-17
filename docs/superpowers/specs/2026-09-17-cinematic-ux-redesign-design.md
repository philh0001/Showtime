# Showtime Cinematic UX Redesign

Approved direction on 17 September 2026. The supplied logo reference and the
instruction to use design judgement select a premium cinematic-dark direction
for the full app. This specification supersedes the visual direction and Home
ordering in the 14 September Phase 7 design where they conflict; existing data,
privacy, tracking and navigation guarantees remain in force.

## Goals

- Put the information people are most likely to need at the top of Home.
- Let people search movies and TV shows directly from Home without navigating
  to another Search screen.
- Establish an original, recognisable Showtime logo and coherent visual system.
- Reduce visual noise and make primary actions and status immediately obvious.
- Improve phone, tablet and desktop usability without weakening accessibility.
- Preserve all existing local data and application behaviour unless this design
  explicitly changes it.

Account creation and cross-device sync remain the next separate phase. This
redesign must not introduce authentication or migrate local data.

## Visual Direction and Brand

Showtime will use a cinematic near-black foundation with warm gold as a
controlled brand accent. Gold identifies selection, progress, primary actions
and important time-sensitive information; it must not cover every heading or
surface. Text remains primarily warm white with muted neutral metadata. Cards
use layered charcoal surfaces and quiet borders rather than white blocks or
heavy glow effects.

Create an original scalable logo inspired by the supplied reference, not a copy:

- a clean `SHOWTIME` wordmark;
- a compact circular play/film mark replacing or integrating with the `O`;
- a restrained gold gradient that remains legible at small sizes;
- a horizontal lockup for Home and About, plus a compact mark for icons and
  constrained spaces; and
- no tagline in the application header.

The logo should be implemented as repository-owned vector artwork so it stays
sharp on every display and can be reused for the favicon and later app icons.
Decorative glow is allowed only as a subtle hero treatment and cannot reduce
contrast or legibility.

## Shared Design Foundation

Centralise semantic tokens for page background, raised and interactive
surfaces, borders, primary and secondary text, gold accent, on-accent text,
success, warning, danger, focus, pressed and disabled states. Centralise page
padding, maximum content width, section spacing, corner radii and standard
control heights. Screens and reusable components must consume these tokens
instead of adding new hard-coded colour families.

The first release remains intentionally dark because that is the approved brand
direction and the deployed app is already dark-only. A later light theme would
need its own design rather than an automatic colour inversion.

All interactive controls need at least a 44-point target, visible keyboard focus
on web, meaningful accessibility labels and non-colour status indicators.
Animation should be brief, optional and never required to understand state.

## Home Information Architecture

Home uses this order:

1. compact Showtime logo/header;
2. inline search field and any active results;
3. Upcoming Episodes;
4. Recently Aired Episodes;
5. Continue Watching;
6. Watchlist;
7. Recently Viewed;
8. Trending Movies and Trending TV; and
9. secondary history content only when it adds value.

Upcoming Episodes is the first content section, directly below search. Watched
Movies no longer needs a prominent Home rail because History and Profile already
provide a clearer destination for completed activity.

On phones the flow stays single-column. On wider displays the header and search
remain one clear top region, episode sections use the available width, and lower
independent collections may form a balanced two-column dashboard. Poster rails
must retain predictable card widths and visible overflow cues.

## Inline Home Search

Replace the current white navigation button with a real, dark search input. Its
placeholder is exactly `Search movies or TV shows`. The control includes a
search icon, clear action when populated, keyboard Search submission and a
visible submit affordance where needed. It must look editable rather than like a
navigation button.

Submitting a query keeps the user on Home. Results appear immediately beneath
the field in a compact result panel with poster, title, year and media type.
Selecting a result opens the existing movie or TV detail route. Clearing the
query closes the panel and restores the dashboard without losing Home data.

Search behaviour, request cancellation, timeout, errors, empty results and
recent-search recording must reuse one shared search controller rather than
duplicating the existing Search screen logic. The Search tab remains available
as the focused, full-page discovery experience, but Home never navigates there
merely to enter a query. Search happens on submit rather than every keystroke to
avoid unnecessary API traffic and rate-limit pressure.

## Upcoming and Recently Aired Episodes

Upcoming Episodes continues to use the local schedule cache and tracked/saved
show rules. It shows the soonest unwatched regular episode per included show,
sorted by air date. Each row prioritises countdown, show title and `Sx Ex`; the
episode name and exact UK date follow. Cache age is secondary information and
must not compete with the episode.

Add a pure `getRecentlyAiredEpisodes` rule over the same validated schedule
records. It includes regular episodes for saved or actively tracked shows whose
air date is between 14 days before today (inclusive) and yesterday. Results are
newest first, deduplicated by show/season/episode and limited to ten. Watched
episodes may remain visible but carry an explicit `Watched` label; this section
answers what aired recently, while Continue Watching answers what to resume.

If there are no upcoming or recently aired episodes, each section uses compact,
specific empty copy only when the user has relevant tracked shows. Unavailable
schedule storage shows one recoverable error treatment and never blocks other
Home content. No new per-show network requests are added on Home.

## Cross-Screen UX Improvements

### Navigation

Use simple icons plus persistent labels for Home, Search, Watchlist and Profile.
The selected destination uses gold and a subtle raised surface. Web navigation
is centred to the same maximum width as page content. Native and web variants
must share semantics, labels and hierarchy.

### Search

Use the shared search controller and result row. Keep recent searches useful but
visually secondary. Results start close to the query, loading does not collapse
the layout, and errors include an immediate retry path. TMDB attribution remains
present without dominating the task.

### Cards and Collections

Unify poster radius, fallback artwork, title/meta typography, status badges and
progress bars. Use gold for active progress and selection; use text or icons in
addition to colour. Sparse collections become useful full-width cards rather
than isolated tiny posters. Larger collections use rails on phones and grids
where width permits.

### Details

Treat backdrop artwork as a cinematic hero with a dark readability overlay.
Place title, year/type, rating, primary Watchlist action and watched/progress
state before long descriptions. Keep trailers, cast, providers and season
tracking clearly separated with consistent section headers. Destructive or
reversal actions remain secondary and explicit.

### Watchlist

Retain All, To Watch and Watched filters but restyle them as a clear segmented
control. Use compact rows on narrow phones and a poster grid on wider screens.
Keep progress on the item and move removal behind a secondary labelled action
that cannot be triggered by opening the title.

### Profile and Settings

Present viewing statistics as scannable cards, then separate History, Settings
and About into distinct groups. Explain that data is currently stored on this
device and reserve account/sync messaging for the later account phase.

## States, Feedback and Copy

Use shared loading, empty, offline, unavailable and retry patterns. Prefer short
task-specific language: say what failed, whether saved data remains available
and what the user can do. Do not clear existing successful content during a
background refresh. Buttons use direct verbs such as `Search`, `Try again`,
`Add to Watchlist` and `Mark watched`.

Pressed, hover, focus, busy, selected, expanded and disabled states must be
visually distinct and exposed to assistive technology. Layouts must tolerate
larger text and long titles without clipping essential actions.

## Component and Data Boundaries

- `ShowtimeLogo`: brand lockup and compact mark with accessible labelling.
- semantic theme/layout tokens: the only source for the redesigned palette and
  common dimensions.
- shared search controller and result components: request lifecycle, recent
  searches and consistent Home/Search rendering.
- episode rules: pure upcoming and recently-aired selection functions with no
  storage or UI dependencies.
- episode presentation: one shared row/card supporting upcoming, recently aired
  and watched states.
- responsive collection components: shared rails, grids, headers and states.

Home coordinates these units but does not absorb their internal logic. Existing
storage services remain responsible for persistence and existing API services
remain responsible for network contracts.

## Verification

Use test-driven development for new rules and changed behaviour. Required
coverage includes:

- recently aired 14-day boundary, ordering, deduplication, tracked-show
  inclusion and watched labels;
- inline search submission, cancellation, success, empty, error, clear and no
  navigation-to-Search behaviour;
- Home section order and conditional empty/error states;
- shared component accessibility states; and
- unchanged local-storage parsing and API contracts.

Run lint, TypeScript, all mobile/server and Worker suites, Expo dependency
validation, production web export, credential scanning and the Cloudflare
release gate. Browser QA covers phone, tablet and desktop widths; keyboard-only
navigation; focus visibility; long text; reduced motion; loading/error/empty
states; direct detail links; and the deployed API. Physical iPhone QA remains a
separate manual gate.

## Delivery Sequence

1. Brand assets, semantic tokens and shared primitives.
2. Shared search controller and inline Home search.
3. Recently aired rules and the top-of-Home episode experience.
4. Home collections and responsive composition.
5. Navigation, Search, Watchlist, Details and Profile consistency pass.
6. Accessibility, responsive browser QA, full verification and deployment.

Each step must preserve a releasable state and avoid unrelated backend or
account work.
