# Showtime mobile

A movie and TV tracking app built with Expo SDK 57, React Native and TypeScript.
The foundation currently includes Home, Search, Watchlist and Profile tabs.
Search displays movie and TV titles, posters, years and media types using TMDB.
The device-local Watchlist, movie watched status and TV tracking are implemented.
Home includes Continue Watching, Recently Viewed, Watched Movies, Watchlist,
cached Upcoming Episodes and Trending Movies/TV. Profile includes local viewing
statistics, a Trending preference, and credits. Optional accounts remain future
work and are not required for the planned public Web/PWA.

## Run locally

Run these commands from this `mobile` directory:

```sh
npm ci
npm start
```

Keep your iPhone and computer on the same Wi-Fi network. Scan the terminal QR
code with the iPhone camera and open the project in Expo Go.
For the browser version, run `npm run web`.

## Source structure

- `src/app/(tabs)`: Home, Search, Watchlist and Profile screens and tab layout.
- `src/app/movie/[id].tsx`: Dynamic movie detail route.
- `src/app/tv/[id].tsx`: Dynamic TV detail route.
- `src/app/_layout.tsx`: Root stack containing the tabs and detail routes.
- `src/components/app-tabs.tsx`: Native tab navigation.
- `src/components/app-tabs.web.tsx`: Browser tab navigation.
- `src/components`, `src/hooks`, `src/constants`: Shared UI and theme helpers.
- `src/services`: Mobile requests plus local search-history, watchlist, Recently Viewed and TV-progress storage.
- `server/`: Computer-only TMDB proxy and its tests. Never import into `src/`.

Expo Router uses files in `src/app` to define routes. The `.web.tsx` suffix
selects the browser-specific implementation of a component.

## Verify changes

```sh
npm run lint
npx tsc --noEmit
npm test
npx expo install --check
npx expo export --platform ios --max-workers 1
```

For the Cloudflare release gate, run `npm run web:export:production` so the
generated browser bundle uses the production API URL, then run
`npm run worker:release-check`. The complete no-go gate includes generated
browser output in the credential scan.

The deployed web app is
`https://showtime-web.showtime-workers.workers.dev`; its API is
`https://showtime-api.showtime-workers.workers.dev`. From `worker/`, deploy the
web bundle with `npx wrangler deploy --config ../mobile/wrangler.jsonc` and the
API with `npm run deploy`.

Then reload in Expo Go and check Home, Search, Watchlist and Profile. Check the
terminal for missing modules, missing assets, routing warnings and runtime errors.
After startup changes, also close and reopen the project to check initial loading.

## Search development setup

1. Copy `.env.example` to `.env.local` if you do not already have the local file.
2. Privately set `TMDB_READ_ACCESS_TOKEN` to your TMDB API Read Access Token.
   `.env.local` is ignored by Git. Never force-add it or put the token in an
   `EXPO_PUBLIC_` variable, app config, logs or screenshots.
3. In one terminal here, run `npm run search:server`.
4. In a second terminal here, run `npm start` and open the app in Expo Go on
   the same private Wi-Fi network. Search for `Batman` or `Breaking Bad`.

Expo Go normally supplies the computer's LAN address automatically. If detection
fails, add `EXPO_PUBLIC_SEARCH_API_URL=http://YOUR_COMPUTER_IP:3001` to `.env.local`
using the Wi-Fi address printed by the search server, and fully reload the app.
On iPhone, `localhost` points to the phone, not your computer. Expo tunnel mode
does not tunnel this separate server. If Windows requests firewall access, allow
Node on your private network for this local test.

The server uses port 3001 and holds the token; only search data reaches the app.
It is a local development tool with no authentication and permissive web CORS.
Do not expose or deploy it publicly as-is. A hosted version needs HTTPS, access
controls and request limits. No database or account system is implemented.

Search shows only movie/TV matches from TMDB's first results page. Selecting a
result opens its detail screen with artwork, description, rating, genres and
release information; TV titles also show seasons. Search by title, open one movie
and one TV result, and use Back to confirm the search and results are preserved.
Also check missing artwork/date fallbacks, try a nonsense title, then stop the
search server and submit again to check the error state.

The five newest successful title searches are stored locally on the device.
Clear the field to see all recent searches, or type part of a previous phrase to
filter the suggestions. Tapping a suggestion runs it again. Use **Clear** to
remove the saved list. Search history is convenience data stored unencrypted;
never use this storage for API credentials or other sensitive information.

## Watchlist

Open a movie or TV detail screen and use **Add to Watchlist**. The Watchlist tab
stores the title, year, media type and poster locally on this device, so it can
render saved titles without another TMDB request. Open a saved row to revisit its
details, or use **Remove** on either screen. Close and reopen Expo Go to verify
that saved titles persist. The first version displays one saved title per row;
a denser layout is planned as a later visual refinement.

## Home and Recently Viewed

Home loads its personal rails from AsyncStorage whenever the tab gains focus.
These collections make no TMDB requests. Use **Search movies and
TV** to find a title, open its detail page successfully, then return Home to see
it at the front of Recently Viewed. Opening a card refreshes its normal detail
route; **See all** opens the full Watchlist.

Recently Viewed keeps the 20 newest movie and TV detail snapshots under
`showtime.recently-viewed.v1`. Reopening a title updates its poster/title fields
and moves it to the front. This activity is independent from Watchlist and
watched status. A failed history write does not block Details, and a failed Home
collection read does not hide the other successfully loaded collection.

Continue Watching joins TV progress to saved, recently viewed and cached TV title metadata.
Untouched and completed shows are excluded. The progress bar counts completed
seasons plus the watched fraction of episode-tracked seasons. Shows removed from
Watchlist remain eligible through the persistent snapshot saved when TV details
open. Existing progress without any title snapshot needs one detail visit.

Movie watched status is stored independently under `showtime.movie-progress.v1`.
Marking a movie watched never adds or removes it from Watchlist. Home previews the
20 newest watched movies; the complete current watched collection is retained.
Marking unwatched removes the current watched record, not Watchlist membership.
This collection is current watched state. The separate viewing history below
preserves newly recorded actions and repeat viewings.

Upcoming Episodes uses `showtime.tv-schedule.v1`, refreshed after successful TV
detail loads. It shows one next non-past, unwatched regular episode per saved or
actively tracked show, ordered by air date. The last-checked date is displayed.
Open TV details to refresh the schedule; no automatic per-show Home requests are
made. The local countdown updates while Home is focused and on app resume.

Trending Movies and TV use one `GET /discovery` call. The proxy fetches TMDB's
weekly movie and TV lists and caches them for 30 minutes, sharing concurrent
requests. The app also caches them in memory for 30 minutes and retains previous
lists after a failed refresh. No background polling runs. Restart the local server
after updating it to enable this endpoint. Trending can be disabled in Profile.

## Profile

Profile refreshes local statistics on focus. Movies and seasons watched are
independent of Watchlist membership. Shows with viewing progress exclude shows
merely opened in Details. Individually tracked episode totals do not estimate
episodes from older whole-season marks. Unavailable collections display unknown
totals, while other totals remain visible.

The Trending preference is stored under `showtime.settings.v1`; unreadable settings
disable discovery requests until the storage can be read again. The About area
includes the Expo app version and TMDB attribution. No sign-in is needed.

## Viewing history

Open **Viewing history** from Profile or **History** beside Home's Watched Movies
rail. The timeline keeps newly recorded movie, season, episode and bulk aired-episode
actions under `showtime.viewing-activity.v1`, including reversals and rewatches.
All/Movies/TV filters and title links are available. Dates and times use the device's
local timezone and UK formatting. Previous TV activity is not reconstructed.

Events are recorded only after watched state saves successfully. If history cannot
be saved, the control reports that separately and retains the saved watched state.
Unreadable history is never silently cleared. The list is virtualized and the full
valid history is retained locally.

## Cast and trailers

Details append TMDB `credits,videos` to the normal request. Up to 12 cast members
and 8 key crew entries are shown. TV's credits endpoint returns latest-season cast,
which is labelled accordingly. Only official trailers on YouTube with validated
video IDs are linked; videos do not autoplay. Missing optional metadata leaves
the main detail and tracking experience available.

## TV tracking

Open a TV detail screen to refresh its season and next-episode data. The newest
relevant regular season loads its episode list, appears first with a clear badge,
and supports individual watched controls for episodes that have aired. Future and
undated episodes remain visible but disabled. Older regular seasons keep their
whole-season controls, and Specials remain visible but untracked.

The next-episode card prefers TMDB's series-level candidate and falls back to the
earliest upcoming episode in the freshly loaded newest season. Dates use the
device's local calendar date for `Airs today`, `Airs tomorrow`, or `Airs in N
days`, and display in UK `DD/MM/YYYY` format. Future seasons show their exact
`Starts DD/MM/YYYY` date. TMDB supplies a date without an exact broadcast time,
so the app does not show an hours-and-minutes countdown or claim a UK broadcast
schedule.

Progress persists under `showtime.tv-progress.v2`; valid v1 whole-season progress
is preserved during migration. The per-season episode shape can later support
older seasons without another storage rewrite. Progress remains independent from
Watchlist membership, so removing and later re-adding a TV show preserves it.
Watchlist progress uses local data only; opening TV details refreshes a show's
season and episode metadata.

`npm run search:tmdb -- "Batman"` is the independent computer-only API check.

TMDB attribution is in Search's Credits section. The unmodified logo comes from
[TMDB's official assets](https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg).

## Startup and assets

Startup uses automatic native splash hiding. The starter JavaScript logo
animation has been removed. App icons and the native splash image referenced in
`app.json` remain placeholders until Showtime branding is prepared.

## Project documentation

- [Project context](../docs/PROJECT_CONTEXT.md)
- [Roadmap](../docs/ROADMAP.md)
- [Deployment and distribution](../docs/DEPLOYMENT-AND-DISTRIBUTION.md)
