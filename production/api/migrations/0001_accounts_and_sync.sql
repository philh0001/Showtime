-- Accounts, sessions and per-device sync storage.
-- Passwords are never stored in plaintext; only a salted hash is kept.
-- Verification/reset tokens store only a hash of the token, never the token itself.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('password', 'google')),
  provider_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, provider_user_id)
);

CREATE INDEX identities_user_id_idx ON identities(user_id);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  device_label TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX sessions_user_id_idx ON sessions(user_id);

CREATE TABLE email_verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at TEXT
);

-- One row per user per synced collection (watchlist, movie-progress,
-- tv-progress, viewing-activity, settings). Storing each collection as a
-- single JSON blob mirrors the existing versioned AsyncStorage shapes and
-- keeps first-cut sync simple: last-write-wins per collection using
-- updated_at, compared against the device's last-known value before
-- overwriting.
CREATE TABLE sync_state (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection TEXT NOT NULL CHECK (collection IN (
    'watchlist', 'movie-progress', 'tv-progress', 'viewing-activity', 'settings'
  )),
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, collection)
);
