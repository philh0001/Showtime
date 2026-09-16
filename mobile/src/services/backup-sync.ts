import AsyncStorage from '@react-native-async-storage/async-storage';

export const BACKUP_FORMAT = 'showtime-local-backup';
export const BACKUP_VERSION = 1;

export const BACKUP_KEYS = [
  '@showtime/watchlist',
  'showtime.movie-progress.v1',
  'showtime.tv-progress.v1',
  'showtime.tv-progress.v2',
  'showtime.settings.v1',
  'showtime.notifications.v1',
  'showtime.recently-viewed.v1',
  '@showtime/recent-searches',
  'showtime.tv-schedule.v1',
  'showtime.viewing-activity.v1',
] as const;

type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export type LocalBackup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  data: Partial<Record<(typeof BACKUP_KEYS)[number], string>>;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function positive(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function nullableString(value: unknown) {
  return value === null || typeof value === 'string';
}

function timestamp(value: unknown) {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function media(value: unknown, idKey: 'id' | 'movieId' = 'id') {
  const item = record(value);
  return !!item && positive(item[idKey]) && typeof item.title === 'string' && !!item.title.trim()
    && nullableString(item.year) && nullableString(item.posterUrl);
}

function positiveNumberArray(value: unknown) {
  return Array.isArray(value) && value.every(positive);
}

function episodeProgress(value: unknown) {
  const item = record(value);
  return !!item && positive(item.seasonNumber)
    && positiveNumberArray(item.knownEpisodeNumbers)
    && positiveNumberArray(item.trackableEpisodeNumbers)
    && positiveNumberArray(item.watchedEpisodeNumbers);
}

function tvProgress(value: unknown, legacy: boolean) {
  const item = record(value);
  return !!item && positive(item.tvId)
    && positiveNumberArray(item.trackableSeasonNumbers)
    && positiveNumberArray(item.watchedSeasonNumbers)
    && (legacy || (Array.isArray(item.episodeProgress) && item.episodeProgress.every(episodeProgress)));
}

function nextEpisode(value: unknown) {
  const item = record(value);
  return !!item && positive(item.id) && (item.name === null || typeof item.name === 'string')
    && Number.isSafeInteger(item.seasonNumber) && Number(item.seasonNumber) >= 0
    && positive(item.episodeNumber) && /^\d{4}-\d{2}-\d{2}$/.test(String(item.airDate));
}

function viewingAction(value: unknown, mediaType: unknown) {
  const item = record(value);
  if (!item || typeof item.watched !== 'boolean') return false;
  if (item.kind === 'movie') return mediaType === 'Movie';
  if (mediaType !== 'TV' || !positive(item.seasonNumber)) return false;
  if (item.kind === 'season') return true;
  if (item.kind === 'episode') return positive(item.episodeNumber);
  return item.kind === 'aired' && positiveNumberArray(item.episodeNumbers)
    && (item.episodeNumbers as unknown[]).length > 0;
}

function validStoredValue(key: (typeof BACKUP_KEYS)[number], raw: string) {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return false; }
  if (key === 'showtime.settings.v1') return typeof record(value)?.showTrending === 'boolean';
  if (key === 'showtime.notifications.v1') return typeof record(value)?.remindersEnabled === 'boolean';
  if (key === '@showtime/recent-searches') {
    return Array.isArray(value) && value.length <= 5
      && value.every((item) => typeof item === 'string' && !!item.trim());
  }
  if (!Array.isArray(value)) return false;
  if (key === '@showtime/watchlist') return value.every((item) => {
    const saved = record(item);
    return media(item) && (saved?.mediaType === 'Movie' || saved?.mediaType === 'TV');
  });
  if (key === 'showtime.movie-progress.v1') {
    return value.every((item) => media(item, 'movieId') && timestamp(record(item)?.watchedAt));
  }
  if (key === 'showtime.tv-progress.v1') return value.every((item) => tvProgress(item, true));
  if (key === 'showtime.tv-progress.v2') return value.every((item) => tvProgress(item, false));
  if (key === 'showtime.recently-viewed.v1') return value.every((item) => {
    const viewed = record(item);
    return media(item) && (viewed?.mediaType === 'Movie' || viewed?.mediaType === 'TV')
      && timestamp(viewed.viewedAt);
  });
  if (key === 'showtime.tv-schedule.v1') return value.every((item) => {
    const schedule = record(item);
    return media(item) && schedule?.mediaType === 'TV' && timestamp(schedule.checkedAt)
      && (schedule.nextEpisode === null || nextEpisode(schedule.nextEpisode))
      && Array.isArray(schedule.episodes) && schedule.episodes.every(nextEpisode);
  });
  return value.every((item) => {
    const event = record(item);
    const title = record(event?.title);
    return !!event && positive(event.sequence) && timestamp(event.happenedAt) && !!title
      && media(title) && (title.mediaType === 'Movie' || title.mediaType === 'TV')
      && viewingAction(event.action, title.mediaType);
  });
}

function isBackup(value: unknown): value is LocalBackup {
  if (!value || typeof value !== 'object') return false;
  const backup = value as Record<string, unknown>;
  if (backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION
    || !timestamp(backup.exportedAt) || !backup.data
    || typeof backup.data !== 'object' || Array.isArray(backup.data)) return false;
  return Object.entries(backup.data).every(([key, raw]) =>
    (BACKUP_KEYS as readonly string[]).includes(key)
    && typeof raw === 'string');
}

export function createBackupSync(storage: Storage, now = () => new Date().toISOString()) {
  return {
    async exportBackup(): Promise<LocalBackup> {
      const entries = await Promise.all(BACKUP_KEYS.map(async (key) => [key, await storage.getItem(key)] as const));
      const data: LocalBackup['data'] = {};
      for (const [key, value] of entries) if (value !== null) data[key] = value;
      return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now(), data };
    },
    async importBackup(raw: string): Promise<void> {
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { throw new Error('Backup is not valid JSON.'); }
      if (!isBackup(parsed)) throw new Error('Backup format or version is not supported.');
      const entries = Object.entries(parsed.data) as [typeof BACKUP_KEYS[number], string][];
      for (const [key, value] of entries) {
        if (!validStoredValue(key, value)) throw new Error(`Backup contains invalid data for ${key}.`);
      }
      const previous = new Map(await Promise.all(entries.map(async ([key]) => [key, await storage.getItem(key)] as const)));
      try {
        for (const [key, value] of entries) await storage.setItem(key, value);
      } catch {
        try {
          for (const [key] of entries) {
            const value = previous.get(key);
            if (value === null || value === undefined) await storage.removeItem(key);
            else await storage.setItem(key, value);
          }
        } catch {
          throw new Error('Import failed and the original local data could not be fully restored.');
        }
        throw new Error('Import failed. The original local data was restored.');
      }
    },
  };
}

export const backupSync = createBackupSync(AsyncStorage);
