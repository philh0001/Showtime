# Showtime mobile

A movie and TV tracking app built with Expo SDK 57, React Native and TypeScript.
The foundation currently includes Home, Search, Watchlist and Profile tabs.
Search, watchlist storage and account functionality are planned.

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
- `src/app/search.tsx`: Search placeholder.
- `src/app/watchlist.tsx`: Watchlist placeholder.
- `src/app/profile.tsx`: Profile placeholder.
- `src/app/_layout.tsx`: Navigation theme and tab layout.
- `src/components/app-tabs.tsx`: Native tab navigation.
- `src/components/app-tabs.web.tsx`: Browser tab navigation.
- `src/components`, `src/hooks`, `src/constants`: Shared UI and theme helpers.

Expo Router uses files in `src/app` to define routes. The `.web.tsx` suffix
selects the browser-specific implementation of a component.

## Verify changes

```sh
npm run lint
npx tsc --noEmit
```

Then reload in Expo Go and check Home, Search, Watchlist and Profile. Check the
terminal for missing modules, missing assets, routing warnings and runtime errors.
After startup changes, also close and reopen the project to check initial loading.

## Startup and assets

Startup uses automatic native splash hiding. The starter JavaScript logo
animation has been removed. App icons and the native splash image referenced in
`app.json` remain placeholders until Showtime branding is prepared.

## Project documentation

- [Project context](../docs/PROJECT_CONTEXT.md)
- [Roadmap](../docs/ROADMAP.md)
