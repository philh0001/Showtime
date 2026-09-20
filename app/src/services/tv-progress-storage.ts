import {
  normalizeTvProgress,
  parseLegacyTvProgress,
  parseTvProgress,
  setAiredEpisodesWatched,
  setEpisodeWatched,
  setSeasonWatched,
  synchronizeTrackingMetadata,
  synchronizeTrackableSeasons,
  type EpisodeMetadata,
  type ProgressLoadResult,
  type TvProgress,
} from './tv-progress-rules.ts';

export const TV_PROGRESS_KEY = 'showtime.tv-progress.v2';
export const LEGACY_TV_PROGRESS_KEY = 'showtime.tv-progress.v1';

type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export class TvProgressUnavailableError extends Error {}

export function createTvProgressStorage(storage: Storage) {
  async function load(): Promise<ProgressLoadResult> {
    try {
      const current = await storage.getItem(TV_PROGRESS_KEY);
      if (current !== null) return parseTvProgress(current);
      return parseLegacyTvProgress(await storage.getItem(LEGACY_TV_PROGRESS_KEY));
    } catch {
      return { status: 'unavailable', reason: 'read-error' };
    }
  }

  async function update(change: (records: TvProgress[]) => TvProgress[]) {
    const loaded = await load();
    if (loaded.status === 'unavailable') {
      throw new TvProgressUnavailableError('TV progress is unavailable.');
    }
    const records = normalizeTvProgress(change(loaded.records));
    await storage.setItem(TV_PROGRESS_KEY, JSON.stringify(records));
    return records;
  }

  return {
    load,
    synchronize: (tvId: number, seasons: number[]) => update(
      (records) => synchronizeTrackableSeasons(records, tvId, seasons),
    ),
    synchronizeTracking: (
      tvId: number,
      seasons: number[],
      episodeMetadata: EpisodeMetadata | null,
    ) => update(
      (records) => synchronizeTrackingMetadata(records, tvId, seasons, episodeMetadata),
    ),
    setSeasonWatched: (tvId: number, seasonNumber: number, watched: boolean) => update(
      (records) => setSeasonWatched(records, tvId, seasonNumber, watched),
    ),
    setEpisodeWatched: (
      tvId: number,
      seasonNumber: number,
      episodeNumber: number,
      watched: boolean,
    ) => update(
      (records) => setEpisodeWatched(records, tvId, seasonNumber, episodeNumber, watched),
    ),
    setAiredEpisodesWatched: (tvId: number, seasonNumber: number, watched: boolean) => update(
      (records) => setAiredEpisodesWatched(records, tvId, seasonNumber, watched),
    ),
  };
}
