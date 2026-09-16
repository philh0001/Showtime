# Showtime

A local-first movie and TV tracker built with Expo SDK 57, React Native and
TypeScript. Search TMDB, save a Watchlist, track seasons and episodes, and see
viewing progress, upcoming episodes and trending titles on Home.

The mobile app is in [`mobile/`](mobile/README.md). Its local Node proxy keeps
the TMDB credential off the device during development. The public web build is
deployed at [showtime-web.showtime-workers.workers.dev](https://showtime-web.showtime-workers.workers.dev)
and uses a separate Cloudflare Worker API. Native iOS distribution remains a
later option only if it adds enough value.

- [Setup and verification](mobile/README.md)
- [Roadmap](docs/ROADMAP.md)
- [Deployment and distribution](docs/DEPLOYMENT-AND-DISTRIBUTION.md)
- [Project context](docs/PROJECT_CONTEXT.md)
- [Latest implementation and verification notes](docs/verification/2026-09-13-roadmap-progress.md)
- [Home screenshot](docs/screenshots/home-web-390.png)
- [Cast and trailer screenshot](docs/screenshots/cast-web-390.png)
