import AsyncStorage from '@react-native-async-storage/async-storage';

import { syncPull, syncPush, type SyncCollection } from './account-api';
import { WATCHLIST_KEY } from './watchlist';
import { MOVIE_PROGRESS_KEY } from './movie-progress-storage';
import { TV_PROGRESS_KEY } from './tv-progress-storage';
import { ACTIVITY_KEY } from './viewing-activity-storage';
import { SETTINGS_KEY } from './settings-storage';

// Syncs the five local AsyncStorage collections with the Worker's per-user
// blob storage (see production/api/src/api/sync.ts). Each collection is treated as
// one opaque JSON blob, matching the server's storage model exactly, so no
// per-item merge logic is needed here.
const SYNC_META_KEY = 'showtime.sync-meta.v1';

const COLLECTION_KEYS: Record<SyncCollection, string> = {
  watchlist: WATCHLIST_KEY,
  'movie-progress': MOVIE_PROGRESS_KEY,
  'tv-progress': TV_PROGRESS_KEY,
  'viewing-activity': ACTIVITY_KEY,
  settings: SETTINGS_KEY,
};

type SyncMeta = Partial<Record<SyncCollection, { data: string; updatedAt: string }>>;

async function loadMeta(): Promise<SyncMeta> {
  const raw = await AsyncStorage.getItem(SYNC_META_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw) as SyncMeta; } catch { return {}; }
}

async function saveMeta(meta: SyncMeta): Promise<void> {
  await AsyncStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
}

export type SyncOutcome = { ok: true; synced: SyncCollection[] } | { ok: false; error: string };

// Pulls the server snapshot, compares each collection against what this
// device last synced, and pushes or applies data as needed:
// - First sync for a collection: prefer the server (so a second device
//   picks up an existing account's data); if the server has nothing yet,
//   push local data up (guest -> account migration for the first device).
// - After that: whichever side changed since the last sync wins; if both
//   changed, the local device's data is pushed (last local action wins).
export async function runSync(sessionToken: string): Promise<SyncOutcome> {
  const pull = await syncPull(sessionToken);
  if (!pull.ok) return { ok: false, error: pull.body?.error ?? 'Could not reach the sync service.' };

  const meta = await loadMeta();
  const synced: SyncCollection[] = [];

  for (const collection of Object.keys(COLLECTION_KEYS) as SyncCollection[]) {
    const localKey = COLLECTION_KEYS[collection];
    const localRaw = await AsyncStorage.getItem(localKey);
    const serverEntry = pull.body.collections[collection];
    const known = meta[collection];

    if (!known) {
      if (serverEntry) {
        await AsyncStorage.setItem(localKey, JSON.stringify(serverEntry.data));
        meta[collection] = { data: JSON.stringify(serverEntry.data), updatedAt: serverEntry.updatedAt };
        synced.push(collection);
      } else if (localRaw !== null) {
        const pushed = await pushCollection(sessionToken, collection, localRaw, meta);
        if (pushed) synced.push(collection);
      }
      continue;
    }

    const localChanged = localRaw !== known.data;
    const serverChanged = serverEntry ? serverEntry.updatedAt !== known.updatedAt : false;

    if (localChanged) {
      const pushed = await pushCollection(sessionToken, collection, localRaw, meta);
      if (pushed) synced.push(collection);
    } else if (serverChanged && serverEntry) {
      await AsyncStorage.setItem(localKey, JSON.stringify(serverEntry.data));
      meta[collection] = { data: JSON.stringify(serverEntry.data), updatedAt: serverEntry.updatedAt };
      synced.push(collection);
    }
  }

  await saveMeta(meta);
  return { ok: true, synced };
}

async function pushCollection(
  sessionToken: string,
  collection: SyncCollection,
  localRaw: string | null,
  meta: SyncMeta,
): Promise<boolean> {
  const data = localRaw === null ? null : JSON.parse(localRaw);
  const response = await syncPush(sessionToken, collection, data);
  if (!response.ok) return false;
  meta[collection] = { data: localRaw ?? 'null', updatedAt: response.body.updatedAt };
  return true;
}
