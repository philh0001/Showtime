// Thin D1 query helpers for accounts, sessions, tokens and synced data.
// No caller outside this module should build raw SQL against these tables.

export type UserRow = {
  id: string;
  email: string;
  email_verified: number;
  password_hash: string | null;
  created_at: string;
};

export type SessionRow = {
  id: string;
  user_id: string;
  token_hash: string;
  device_label: string | null;
  created_at: string;
  expires_at: string;
};

export type VerificationTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
};

export type ResetTokenRow = VerificationTokenRow;

export type SyncStateRow = {
  collection: string;
  data: string;
  updated_at: string;
  revision: number;
};

export async function findUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return (await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>()) ?? null;
}

export async function findUserById(db: D1Database, id: string): Promise<UserRow | null> {
  return (await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>()) ?? null;
}

export async function createUser(db: D1Database, options: { id: string; email: string; passwordHash: string }): Promise<void> {
  await db.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)")
    .bind(options.id, options.email, options.passwordHash).run();
}

export async function createIdentity(
  db: D1Database,
  options: { id: string; userId: string; provider: "password" | "google"; providerUserId: string },
): Promise<void> {
  await db.prepare("INSERT INTO identities (id, user_id, provider, provider_user_id) VALUES (?, ?, ?, ?)")
    .bind(options.id, options.userId, options.provider, options.providerUserId).run();
}

export async function createSession(
  db: D1Database,
  options: { id: string; userId: string; tokenHash: string; deviceLabel: string | null; expiresAt: string },
): Promise<void> {
  await db.prepare("INSERT INTO sessions (id, user_id, token_hash, device_label, expires_at) VALUES (?, ?, ?, ?, ?)")
    .bind(options.id, options.userId, options.tokenHash, options.deviceLabel, options.expiresAt).run();
}

export async function findSessionByTokenHash(db: D1Database, tokenHash: string): Promise<SessionRow | null> {
  return (await db.prepare("SELECT * FROM sessions WHERE token_hash = ?").bind(tokenHash).first<SessionRow>()) ?? null;
}

export async function deleteSessionByTokenHash(db: D1Database, tokenHash: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}

export async function deleteSessionsByUserId(db: D1Database, userId: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
}

export async function createVerificationToken(
  db: D1Database,
  options: { id: string; userId: string; tokenHash: string; expiresAt: string },
): Promise<void> {
  await db.prepare("INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
    .bind(options.id, options.userId, options.tokenHash, options.expiresAt).run();
}

export async function findActiveVerificationToken(db: D1Database, tokenHash: string): Promise<VerificationTokenRow | null> {
  return (await db.prepare(
    "SELECT * FROM email_verification_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')",
  ).bind(tokenHash).first<VerificationTokenRow>()) ?? null;
}

export async function markVerificationTokenUsed(db: D1Database, id: string): Promise<void> {
  await db.prepare("UPDATE email_verification_tokens SET used_at = datetime('now') WHERE id = ?").bind(id).run();
}

export async function markEmailVerified(db: D1Database, userId: string): Promise<void> {
  await db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").bind(userId).run();
}

export async function createResetToken(
  db: D1Database,
  options: { id: string; userId: string; tokenHash: string; expiresAt: string },
): Promise<void> {
  await db.prepare("INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
    .bind(options.id, options.userId, options.tokenHash, options.expiresAt).run();
}

export async function findActiveResetToken(db: D1Database, tokenHash: string): Promise<ResetTokenRow | null> {
  return (await db.prepare(
    "SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')",
  ).bind(tokenHash).first<ResetTokenRow>()) ?? null;
}

export async function markResetTokenUsed(db: D1Database, id: string): Promise<void> {
  await db.prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?").bind(id).run();
}

export async function updatePasswordHash(db: D1Database, userId: string, passwordHash: string): Promise<void> {
  await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(passwordHash, userId).run();
}

export async function getAllSyncState(db: D1Database, userId: string): Promise<SyncStateRow[]> {
  const { results } = await db.prepare("SELECT collection, data, updated_at, revision FROM sync_state WHERE user_id = ?")
    .bind(userId).all<SyncStateRow>();
  return results;
}

// A conditional write is atomic in D1. A stale device must pull and merge
// before trying again; server timestamps cannot establish what it last saw.
export async function putSyncState(
  db: D1Database, userId: string, collection: string, data: string,
  updatedAt: string, expectedRevision: number | null,
): Promise<number | null> {
  if (expectedRevision === null) {
    const inserted = await db.prepare(`
      INSERT INTO sync_state (user_id, collection, data, updated_at, revision)
      VALUES (?, ?, ?, ?, 1) ON CONFLICT(user_id, collection) DO NOTHING
      RETURNING revision
    `).bind(userId, collection, data, updatedAt).first<{ revision: number }>();
    return inserted?.revision ?? null;
  }
  const updated = await db.prepare(`
    UPDATE sync_state SET data = ?, updated_at = ?, revision = revision + 1
    WHERE user_id = ? AND collection = ? AND revision = ?
    RETURNING revision
  `).bind(data, updatedAt, userId, collection, expectedRevision).first<{ revision: number }>();
  return updated?.revision ?? null;
}
