import type { RecentlyViewedSnapshot } from './recently-viewed-rules.ts';

export type ViewingAction =
  | { kind: 'movie'; watched: boolean }
  | { kind: 'season'; seasonNumber: number; watched: boolean }
  | { kind: 'episode'; seasonNumber: number; episodeNumber: number; watched: boolean }
  | { kind: 'aired'; seasonNumber: number; episodeNumbers: number[]; watched: boolean };
export type ViewingActivity = {
  id?: string; sequence: number; title: RecentlyViewedSnapshot; action: ViewingAction; happenedAt: string;
};
export type ActivityLoadResult = { status: 'available'; records: ViewingActivity[] } | { status: 'unavailable' };
export type ActivityFilter = 'all' | 'Movie' | 'TV';

function positive(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) > 0; }

function normalizeAction(value: unknown, mediaType: 'Movie' | 'TV'): ViewingAction | null {
  if (!value || typeof value !== 'object') return null;
  const action = value as Record<string, unknown>;
  if (typeof action.watched !== 'boolean') return null;
  const watched = action.watched;
  if (action.kind === 'movie') return mediaType === 'Movie' ? { kind: 'movie', watched } : null;
  if (mediaType !== 'TV' || !positive(action.seasonNumber)) return null;
  const seasonNumber = action.seasonNumber;
  if (action.kind === 'season') return { kind: 'season', seasonNumber, watched };
  if (action.kind === 'episode' && positive(action.episodeNumber)) {
    return { kind: 'episode', seasonNumber, episodeNumber: action.episodeNumber, watched };
  }
  if (action.kind === 'aired' && Array.isArray(action.episodeNumbers)) {
    const episodeNumbers = [...new Set(action.episodeNumbers.filter(positive))].sort((a, b) => a - b);
    return episodeNumbers.length > 0 ? { kind: 'aired', seasonNumber, episodeNumbers, watched } : null;
  }
  return null;
}

export function normalizeViewingActivity(value: unknown): ViewingActivity | null {
  if (!value || typeof value !== 'object') return null;
  const event = value as Record<string, unknown>;
  if (!positive(event.sequence) || typeof event.happenedAt !== 'string'
    || (event.id !== undefined && (typeof event.id !== 'string' || !event.id))
    || !Number.isFinite(Date.parse(event.happenedAt))
    || new Date(event.happenedAt).toISOString() !== event.happenedAt
    || !event.title || typeof event.title !== 'object') return null;
  const title = event.title as Record<string, unknown>;
  if (!positive(title.id) || (title.mediaType !== 'Movie' && title.mediaType !== 'TV')
    || typeof title.title !== 'string' || !title.title.trim()
    || (title.year !== null && typeof title.year !== 'string')
    || (title.posterUrl !== null && typeof title.posterUrl !== 'string')) return null;
  const action = normalizeAction(event.action, title.mediaType);
  if (!action) return null;
  return { ...(typeof event.id === 'string' ? { id: event.id } : {}),
    sequence: event.sequence, happenedAt: event.happenedAt, action,
    title: { id: title.id, mediaType: title.mediaType, title: title.title.trim(),
      year: title.year as string | null, posterUrl: title.posterUrl as string | null } };
}

export function parseViewingActivity(stored: string | null): ActivityLoadResult {
  if (stored === null) return { status: 'available', records: [] };
  try {
    const data: unknown = JSON.parse(stored);
    if (!Array.isArray(data)) return { status: 'unavailable' };
    const events = new Map<string, ViewingActivity>();
    for (const value of data) {
      const event = normalizeViewingActivity(value);
      const key = event?.id ?? `legacy:${event?.sequence}`;
      if (event && !events.has(key)) events.set(key, event);
    }
    return { status: 'available', records: [...events.values()]
      .sort((a, b) => b.happenedAt.localeCompare(a.happenedAt) || b.sequence - a.sequence) };
  } catch { return { status: 'unavailable' }; }
}

export function filterViewingActivity(records: ViewingActivity[], filter: ActivityFilter) {
  return filter === 'all' ? records : records.filter((event) => event.title.mediaType === filter);
}

export function describeViewingAction(action: ViewingAction) {
  const verb = action.watched ? 'Watched' : 'Marked unwatched';
  if (action.kind === 'movie') return action.watched ? 'Watched movie' : 'Marked movie unwatched';
  if (action.kind === 'season') return action.watched ? `Watched season ${action.seasonNumber}` : `Marked season ${action.seasonNumber} unwatched`;
  if (action.kind === 'episode') return `${verb} S${action.seasonNumber} E${action.episodeNumber}`;
  return `${verb} ${action.episodeNumbers.length} episode${action.episodeNumbers.length === 1 ? '' : 's'} in season ${action.seasonNumber}`;
}
