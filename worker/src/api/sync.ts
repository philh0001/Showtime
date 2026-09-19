// Pull/push handlers for the five synced local collections. Each collection
// is stored as one JSON blob per user; conflict handling is last-write-wins
// by client-supplied updatedAt, enforced in db.ts's putSyncState.
import { getAllSyncState, putSyncState, type UserRow } from "../auth/db";
import type { ApiResult, Deps } from "./auth";

const COLLECTIONS = ["watchlist", "movie-progress", "tv-progress", "viewing-activity", "settings"] as const;
type Collection = (typeof COLLECTIONS)[number];

// Generous but bounded: a synced collection is a small JSON snapshot, not a
// media/file payload.
const MAX_BLOB_BYTES = 200_000;

function isCollection(value: unknown): value is Collection {
  return typeof value === "string" && (COLLECTIONS as readonly string[]).includes(value);
}

export async function handleSyncPull(user: UserRow, { db }: Deps): Promise<ApiResult> {
  if (user.email_verified !== 1) return { status: 403, body: { error: "Verify your email before syncing." } };
  const rows = await getAllSyncState(db, user.id);
  const collections: Record<string, { data: unknown; updatedAt: string }> = {};
  for (const row of rows) {
    try {
      collections[row.collection] = { data: JSON.parse(row.data), updatedAt: row.updated_at };
    } catch {
      // Skip a corrupt stored row rather than fail the whole pull.
    }
  }
  return { status: 200, body: { collections } };
}

export async function handleSyncPush(user: UserRow, body: unknown, { db, now }: Deps): Promise<ApiResult> {
  if (user.email_verified !== 1) return { status: 403, body: { error: "Verify your email before syncing." } };
  const record = body as { collection?: unknown; data?: unknown };
  if (!isCollection(record?.collection)) return { status: 400, body: { error: "Unknown collection." } };
  if (record.data === undefined) return { status: 400, body: { error: "Missing data." } };

  const serialized = JSON.stringify(record.data);
  if (new TextEncoder().encode(serialized).byteLength > MAX_BLOB_BYTES) {
    return { status: 413, body: { error: "Data is too large to sync." } };
  }
  const updatedAt = new Date(now()).toISOString();
  await putSyncState(db, user.id, record.collection, serialized, updatedAt);
  return { status: 200, body: { collection: record.collection, updatedAt } };
}
