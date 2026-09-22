-- Existing snapshots begin at revision 1. Future writes require the device's
-- last observed revision, so a stale snapshot cannot replace a newer one.
ALTER TABLE sync_state ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
