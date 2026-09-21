import type { SyncCollection } from './account-api';

const ABSENT = Symbol('absent');
type Entry = unknown | typeof ABSENT;

function same(left: Entry, right: Entry): boolean {
  return left === ABSENT || right === ABSENT
    ? left === right : JSON.stringify(left) === JSON.stringify(right);
}

function object(value: Entry): value is Record<string, unknown> {
  return value !== ABSENT && value !== null && typeof value === 'object' && !Array.isArray(value);
}

function keyFor(collection: SyncCollection, path: string[], item: unknown): string {
  const field = path.at(-1);
  if (collection === 'tv-progress' && field !== undefined) {
    if (field === 'episodeProgress' && object(item) && Number.isSafeInteger(item.seasonNumber)) {
      return String(item.seasonNumber);
    }
    if (typeof item === 'number' && Number.isSafeInteger(item) && item > 0) return String(item);
    throw new Error('Invalid TV progress in sync data.');
  }
  if (!object(item)) throw new Error('Invalid collection item in sync data.');
  if (collection === 'watchlist' && (item.mediaType === 'Movie' || item.mediaType === 'TV')
    && Number.isSafeInteger(item.id)) return `${item.mediaType}:${item.id}`;
  if (collection === 'movie-progress' && Number.isSafeInteger(item.movieId)) return String(item.movieId);
  if (collection === 'tv-progress' && Number.isSafeInteger(item.tvId)) return String(item.tvId);
  if (collection === 'viewing-activity') {
    if (typeof item.id === 'string' && item.id) return item.id;
    if (typeof item.happenedAt === 'string' && object(item.title) && Number.isSafeInteger(item.title.id)) {
      return `legacy:${item.sequence}:${item.happenedAt}:${item.title.mediaType}:${item.title.id}:${JSON.stringify(item.action)}`;
    }
  }
  throw new Error('Invalid collection item in sync data.');
}

function indexed(collection: SyncCollection, path: string[], values: unknown[]): Map<string, unknown> {
  const result = new Map<string, unknown>();
  for (const value of values) {
    const key = keyFor(collection, path, value);
    if (result.has(key)) throw new Error('Duplicate item in sync data.');
    result.set(key, value);
  }
  return result;
}

function mergeArray(
  collection: SyncCollection, path: string[], base: Entry, local: unknown[], remote: unknown[],
): unknown[] {
  const baseItems = indexed(collection, path, Array.isArray(base) ? base : []);
  const localItems = indexed(collection, path, local);
  const remoteItems = indexed(collection, path, remote);
  const keys = new Set([...localItems.keys(), ...remoteItems.keys(), ...baseItems.keys()]);
  const merged: unknown[] = [];
  for (const key of keys) {
    const value = mergeValue(collection, path.concat(key),
      baseItems.get(key) ?? ABSENT, localItems.get(key) ?? ABSENT, remoteItems.get(key) ?? ABSENT);
    if (value !== ABSENT) merged.push(value);
  }
  if (collection === 'tv-progress' && path.length > 0 && path.at(-1) !== 'episodeProgress') {
    return (merged as number[]).sort((a, b) => a - b);
  }
  if (collection === 'viewing-activity' && path.length === 0) {
    return merged.map((value): Record<string, unknown> => {
      const event = value as Record<string, unknown>;
      return { ...event, id: keyFor(collection, path, event) };
    }).sort((a, b) => String(b.happenedAt).localeCompare(String(a.happenedAt))
      || String(a.id).localeCompare(String(b.id)))
      .map((event, index, events) => ({ ...event, sequence: events.length - index }));
  }
  return merged;
}

function mergeValue(collection: SyncCollection, path: string[], base: Entry, local: Entry, remote: Entry): Entry {
  if (same(local, remote)) return local;
  if (same(local, base)) return remote;
  if (same(remote, base)) return local;
  // Concurrent deletion takes precedence over an update to the same item.
  if (local === ABSENT || remote === ABSENT) return ABSENT;
  if (Array.isArray(local) && Array.isArray(remote)) return mergeArray(collection, path, base, local, remote);
  if (object(local) && object(remote)) {
    const prior = object(base) ? base : {};
    const merged: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(prior)])) {
      const value = mergeValue(collection, path.concat(key),
        Object.hasOwn(prior, key) ? prior[key] : ABSENT,
        Object.hasOwn(local, key) ? local[key] : ABSENT,
        Object.hasOwn(remote, key) ? remote[key] : ABSENT);
      if (value !== ABSENT) merged[key] = value;
    }
    return merged;
  }
  if (collection === 'movie-progress' && path.at(-1) === 'watchedAt'
    && typeof local === 'string' && typeof remote === 'string') return local > remote ? local : remote;
  // An explicit local edit wins an otherwise irresolvable scalar conflict.
  return local;
}

// Three-way merge: a missing base means this is the device's first sync.
// Distinct records are retained, while a removal since the base is respected.
export function mergeSyncData(
  collection: SyncCollection, base: unknown | undefined, local: unknown | null, remote: unknown | null,
): unknown | null {
  const merged = mergeValue(collection, [], base === undefined ? ABSENT : base,
    local === null ? ABSENT : local, remote === null ? ABSENT : remote);
  return merged === ABSENT ? null : merged;
}
