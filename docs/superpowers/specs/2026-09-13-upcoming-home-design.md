# Upcoming Episodes on Home

Store a validated TV display snapshot, next-episode candidate, newest-season
dated episode candidates, and checkedAt timestamp in `showtime.tv-schedule.v1`.
Refresh this cache only after successful TV detail loads. Home reads it once per
focus and performs no per-show requests. This is a local first version, not a
claim that schedules refresh automatically or represent UK broadcaster times.

Include shows saved in Watchlist or with actual viewing progress. Select the
next non-past regular episode using the existing date-only helpers, omit watched
episodes, sort by air date and show title, and display UK date/countdown plus the
last checked date. An empty cache is valid; unreadable data is unavailable and
must never be overwritten automatically. Serialize writes to avoid lost updates.

The cache preserves all valid title records. It contains public metadata only.
Movie details never write this cache. Cache failures must not prevent details or
tracking from loading. Device verification remains pending while the user is away.
