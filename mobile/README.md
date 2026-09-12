# Showtime mobile

A movie and TV tracking app built with Expo SDK 57, React Native and TypeScript.
The foundation currently includes Home, Search, Watchlist and Profile tabs.
Search displays movie and TV titles, posters, years and media types using TMDB.
Watchlist storage and account functionality are planned.

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

- `src/app/index.tsx`: Home screen.
- `src/app/search.tsx`: Title search with loading, error and empty states.
- `src/app/watchlist.tsx`: Watchlist placeholder.
- `src/app/profile.tsx`: Profile placeholder.
- `src/app/_layout.tsx`: Navigation theme and tab layout.
- `src/components/app-tabs.tsx`: Native tab navigation.
- `src/components/app-tabs.web.tsx`: Browser tab navigation.
- `src/components`, `src/hooks`, `src/constants`: Shared UI and theme helpers.
- `src/services/search.ts`: Mobile requests to the local search server.
- `server/`: Computer-only TMDB proxy and its tests. Never import into `src/`.

Expo Router uses files in `src/app` to define routes. The `.web.tsx` suffix
selects the browser-specific implementation of a component.

## Verify changes

```sh
npm run lint
npx tsc --noEmit
npm run test:search
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

The first version shows only movie/TV matches from TMDB's first results page.
Search by title, check missing artwork/date fallbacks, try a nonsense title,
then stop the search server and submit again to check the error state.

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
