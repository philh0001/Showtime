# Showtime mobile

A movie and TV tracking app built with Expo SDK 57, React Native and TypeScript.
The foundation currently includes Home, Search, Watchlist and Profile tabs.
Search displays movie and TV titles, posters, years and media types using TMDB.
The device-local Watchlist is verified, and the first TV season-tracking version
is implemented. Account functionality is planned.

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
- `src/services`: Mobile requests plus local search-history, watchlist and TV-progress storage.
- `server/`: Computer-only TMDB proxy and its tests. Never import into `src/`.

Expo Router uses files in `src/app` to define routes. The `.web.tsx` suffix
selects the browser-specific implementation of a component.

## Verify changes

```sh
npm run lint
npx tsc --noEmit
npm run test:search
npm run test:history
npm run test:watchlist
npm run test:tracking
```

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
