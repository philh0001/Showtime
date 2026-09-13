# Viewing Activity History

Add an append-only device-local activity timeline, separate from current movie
watched status, TV progress, Watchlist and Recently Viewed. Store title snapshots,
exact action targets and timestamps under `showtime.viewing-activity.v1`. Actions
include marking/unmarking movies, seasons, individual episodes and aired-episode
groups. Rewatches remain separate events. No account or network request is needed.

Record only after the primary watched-state write succeeds. A history failure
must not undo a successful progress update; the control reports that progress was
saved but history was not. Serialize history writes and never overwrite unreadable
storage. Keep every valid event, using monotonically increasing local sequence IDs.
Reject malformed action shapes, mismatched media types, invalid IDs and timestamps.

Add a stack route `/history`, accessible from Profile and the Watched Movies Home
rail. Use a virtualized newest-first list with All/Movies/TV filters, UK local date
and time, title artwork, activity wording and normal detail links. Empty, loading,
retry and storage-error states must be explicit. Returning preserves tab state.

History starts with actions recorded after this feature is introduced. Do not
invent timestamps for prior TV progress or reconstruct events from Recently Viewed.
Existing watched collections remain unchanged. Physical iPhone verification is
pending while the user is away.
