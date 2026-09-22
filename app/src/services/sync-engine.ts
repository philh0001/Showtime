import type { ApiResponse, SyncCollection, SyncPullBody } from './sync-types';
import { parseMovieProgress } from './movie-progress-rules.ts';
import { parseTvProgress } from './tv-progress-rules.ts';
import { parseViewingActivity } from './viewing-activity-rules.ts';
import { parseWatchlist } from './watchlist-rules.ts';
import { mergeSyncData } from './sync-merge.ts';

type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};
type PushBody = { revision: number; updatedAt: string; error?: string };
type Api = {
  pull: (token: string) => Promise<ApiResponse<SyncPullBody>>;
  push: (token: string, collection: SyncCollection, data: unknown, expectedRevision: number | null) => Promise<ApiResponse<PushBody>>;
};
type MetaEntry = { data: unknown; revision: number };
type Meta = Partial<Record<SyncCollection, MetaEntry>>;
export type SyncOutcome = { ok: true; synced: SyncCollection[] } | { ok: false; error: string };

const META_PREFIX = 'showtime.sync-meta.v2:';

function positiveNumbers(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((number) => Number.isSafeInteger(number) && number > 0)
    && new Set(value).size === value.length;
}

function validTvRecord(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (!Number.isSafeInteger(record.tvId) || Number(record.tvId) < 1
    || !positiveNumbers(record.trackableSeasonNumbers)
    || !positiveNumbers(record.watchedSeasonNumbers)
    || !Array.isArray(record.episodeProgress)) return false;
  const seasons = new Set<number>();
  for (const value of record.episodeProgress) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const episode = value as Record<string, unknown>;
    if (!Number.isSafeInteger(episode.seasonNumber) || Number(episode.seasonNumber) < 1
      || seasons.has(Number(episode.seasonNumber))
      || !positiveNumbers(episode.knownEpisodeNumbers)
      || !positiveNumbers(episode.trackableEpisodeNumbers)
      || !positiveNumbers(episode.watchedEpisodeNumbers)) return false;
    seasons.add(Number(episode.seasonNumber));
  }
  return true;
}

function validData(collection: SyncCollection, value: unknown): boolean {
  if (value === null) return true;
  if (collection === 'settings') {
    return !!value && typeof value === 'object' && !Array.isArray(value)
      && typeof (value as Record<string, unknown>).showTrending === 'boolean';
  }
  if (!Array.isArray(value)) return false;
  const raw = JSON.stringify(value);
  if (collection === 'watchlist') return parseWatchlist(raw).length === value.length;
  if (collection === 'movie-progress') {
    const parsed = parseMovieProgress(raw);
    return parsed.status === 'available' && parsed.records.length === value.length;
  }
  if (collection === 'tv-progress') {
    const parsed = parseTvProgress(raw);
    return parsed.status === 'available' && parsed.records.length === value.length
      && value.every(validTvRecord);
  }
  const parsed = parseViewingActivity(raw);
  return parsed.status === 'available' && parsed.records.length === value.length;
}

function parseLocal(collection: SyncCollection, raw: string | null): unknown | null {
  if (raw === null) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error(`${collection} is unreadable on this device.`); }
  if (value === null || !validData(collection, value)) {
    throw new Error(`${collection} is unreadable on this device.`);
  }
  return value;
}

function responseError(response: ApiResponse<{ error?: string }>, fallback: string): string {
  return response.body?.error ?? fallback;
}

export function createSyncEngine(storage: Storage, api: Api, keys: Partial<Record<SyncCollection, string>>) {
  let pending: Promise<unknown> = Promise.resolve();

  async function execute(token: string, userId: string): Promise<SyncOutcome> {
    try {
      const metaKey = `${META_PREFIX}${userId}`;
      const metaRaw = await storage.getItem(metaKey);
      let meta: Meta = {};
      if (metaRaw !== null) {
        try { meta = JSON.parse(metaRaw) as Meta; }
        catch { throw new Error('Sync history is unreadable on this device.'); }
        if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
          throw new Error('Sync history is unreadable on this device.');
        }
      }
      const initial = await api.pull(token);
      if (!initial.ok || !initial.body?.collections) {
        return { ok: false, error: responseError(initial, 'Could not reach the sync service.') };
      }
      const synced: SyncCollection[] = [];
      for (const collection of Object.keys(keys) as SyncCollection[]) {
        const localKey = keys[collection];
        if (!localKey) continue;
        let serverEntry = initial.body.collections[collection] ?? null;
        let complete = false;
        for (let attempt = 0; attempt < 4; attempt++) {
          const localRaw = await storage.getItem(localKey);
          const local = parseLocal(collection, localRaw);
          const known = meta[collection];
          if (known && (!Number.isSafeInteger(known.revision) || known.revision < 1 || !validData(collection, known.data))) {
            throw new Error('Sync history is unreadable on this device.');
          }
          if (serverEntry && (!Number.isSafeInteger(serverEntry.revision) || serverEntry.revision < 1
            || !validData(collection, serverEntry.data))) {
            throw new Error(`${collection} is unreadable in the cloud.`);
          }
          if (local === null && !serverEntry && !known) { complete = true; break; }
          // A missing key, cloud row or null cloud snapshot is not an explicit
          // delete. Collections save empty arrays after deliberate removals.
          const merged = local === null ? (serverEntry?.data ?? null)
            : !serverEntry || serverEntry.data === null ? local
              : mergeSyncData(collection, known?.data, local, serverEntry.data);
          if (!validData(collection, merged)) throw new Error(`${collection} could not be merged safely.`);
          let changed = false;
          if (JSON.stringify(merged) !== JSON.stringify(serverEntry?.data ?? null)) {
            const push = await api.push(token, collection, merged, serverEntry?.revision ?? null);
            if (push.status === 409) {
              const latest = await api.pull(token);
              if (!latest.ok || !latest.body?.collections) {
                return { ok: false, error: responseError(latest, 'Could not retry the sync conflict.') };
              }
              serverEntry = latest.body.collections[collection] ?? null;
              continue;
            }
            if (!push.ok) return { ok: false, error: responseError(push, `Could not sync ${collection}.`) };
            if (!Number.isSafeInteger(push.body?.revision) || push.body.revision < 1) {
              throw new Error('The sync service returned an invalid revision.');
            }
            serverEntry = { data: merged, revision: push.body.revision, updatedAt: push.body.updatedAt };
            changed = true;
          }
          const currentRaw = await storage.getItem(localKey);
          if (currentRaw === localRaw) {
            const mergedRaw = merged === null ? null : JSON.stringify(merged);
            if (mergedRaw !== currentRaw) {
              if (mergedRaw === null) await storage.removeItem(localKey);
              else await storage.setItem(localKey, mergedRaw);
              changed = true;
            }
          }
          if (serverEntry) {
            meta[collection] = { data: merged, revision: serverEntry.revision };
            await storage.setItem(metaKey, JSON.stringify(meta));
          }
          if (changed && !synced.includes(collection)) synced.push(collection);
          if (currentRaw !== localRaw) continue;
          complete = true;
          break;
        }
        if (!complete) return { ok: false, error: `${collection} changed during sync. Please retry.` };
      }
      return { ok: true, synced };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Could not sync the library.' };
    }
  }

  return {
    run(token: string, userId: string): Promise<SyncOutcome> {
      const result = pending.then(() => execute(token, userId));
      pending = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}
