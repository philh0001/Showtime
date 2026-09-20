import { parseIsoCalendarDate } from './air-date-rules.ts';

export type EpisodeProgress = {
  seasonNumber: number;
  knownEpisodeNumbers: number[];
  trackableEpisodeNumbers: number[];
  watchedEpisodeNumbers: number[];
};

export type TvProgress = {
  tvId: number;
  trackableSeasonNumbers: number[];
  watchedSeasonNumbers: number[];
  episodeProgress: EpisodeProgress[];
};

export type ProgressLoadResult =
  | { status: 'available'; records: TvProgress[] }
  | { status: 'unavailable'; reason: 'malformed' | 'read-error' };

type SeasonSummary = { seasonNumber: number; airDate: string | null };
type EpisodeSummary = { episodeNumber: number; airDate: string | null };
export type EpisodeMetadata = Omit<EpisodeProgress, 'watchedEpisodeNumbers'>;

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function sortedPositiveNumbers(values: unknown[]) {
  return [...new Set(values.filter(isPositiveSafeInteger))].sort((a, b) => a - b);
}

function normalizeEpisodeProgress(values: unknown[]) {
  const merged = new Map<number, EpisodeProgress>();
  for (const value of values) {
    if (!value || typeof value !== 'object') continue;
    const record = value as Record<string, unknown>;
    if (!isPositiveSafeInteger(record.seasonNumber)
      || !Array.isArray(record.knownEpisodeNumbers)
      || !Array.isArray(record.trackableEpisodeNumbers)
      || !Array.isArray(record.watchedEpisodeNumbers)) continue;
    const current = merged.get(record.seasonNumber);
    merged.set(record.seasonNumber, {
      seasonNumber: record.seasonNumber,
      knownEpisodeNumbers: sortedPositiveNumbers([
        ...(current?.knownEpisodeNumbers ?? []), ...record.knownEpisodeNumbers,
      ]),
      trackableEpisodeNumbers: sortedPositiveNumbers([
        ...(current?.trackableEpisodeNumbers ?? []), ...record.trackableEpisodeNumbers,
      ]),
      watchedEpisodeNumbers: sortedPositiveNumbers([
        ...(current?.watchedEpisodeNumbers ?? []), ...record.watchedEpisodeNumbers,
      ]),
    });
  }
  return [...merged.values()].sort((a, b) => a.seasonNumber - b.seasonNumber);
}

export function normalizeTvProgress(records: TvProgress[]) {
  const merged = new Map<number, TvProgress>();
  for (const record of records) {
    if (!isPositiveSafeInteger(record.tvId)) continue;
    const current = merged.get(record.tvId);
    merged.set(record.tvId, {
      tvId: record.tvId,
      trackableSeasonNumbers: sortedPositiveNumbers([
        ...(current?.trackableSeasonNumbers ?? []),
        ...(Array.isArray(record.trackableSeasonNumbers) ? record.trackableSeasonNumbers : []),
      ]),
      watchedSeasonNumbers: sortedPositiveNumbers([
        ...(current?.watchedSeasonNumbers ?? []),
        ...(Array.isArray(record.watchedSeasonNumbers) ? record.watchedSeasonNumbers : []),
      ]),
      episodeProgress: normalizeEpisodeProgress([
        ...(current?.episodeProgress ?? []),
        ...(Array.isArray(record.episodeProgress) ? record.episodeProgress : []),
      ]),
    });
  }
  return [...merged.values()].sort((a, b) => a.tvId - b.tvId);
}

function parseArray(stored: string | null) {
  if (stored === null) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseTvProgress(stored: string | null): ProgressLoadResult {
  const parsed = parseArray(stored);
  if (parsed === null) return { status: 'unavailable', reason: 'malformed' };
  const records: TvProgress[] = [];
  for (const value of parsed) {
    if (!value || typeof value !== 'object') continue;
    const record = value as Record<string, unknown>;
    if (!isPositiveSafeInteger(record.tvId)
      || !Array.isArray(record.trackableSeasonNumbers)
      || !Array.isArray(record.watchedSeasonNumbers)
      || !Array.isArray(record.episodeProgress)) continue;
    records.push({
      tvId: record.tvId,
      trackableSeasonNumbers: sortedPositiveNumbers(record.trackableSeasonNumbers),
      watchedSeasonNumbers: sortedPositiveNumbers(record.watchedSeasonNumbers),
      episodeProgress: normalizeEpisodeProgress(record.episodeProgress),
    });
  }
  return { status: 'available', records: normalizeTvProgress(records) };
}

export function parseLegacyTvProgress(stored: string | null): ProgressLoadResult {
  const parsed = parseArray(stored);
  if (parsed === null) return { status: 'unavailable', reason: 'malformed' };
  const records: TvProgress[] = [];
  for (const value of parsed) {
    if (!value || typeof value !== 'object') continue;
    const record = value as Record<string, unknown>;
    if (!isPositiveSafeInteger(record.tvId)
      || !Array.isArray(record.trackableSeasonNumbers)
      || !Array.isArray(record.watchedSeasonNumbers)) continue;
    records.push({
      tvId: record.tvId,
      trackableSeasonNumbers: sortedPositiveNumbers(record.trackableSeasonNumbers),
      watchedSeasonNumbers: sortedPositiveNumbers(record.watchedSeasonNumbers),
      episodeProgress: [],
    });
  }
  return { status: 'available', records: normalizeTvProgress(records) };
}

export function deriveTrackableSeasonNumbers(seasons: SeasonSummary[], todayIso: string) {
  if (!parseIsoCalendarDate(todayIso)) return [];
  return sortedPositiveNumbers(seasons.filter((season) => {
    if (!isPositiveSafeInteger(season.seasonNumber)) return false;
    if (season.airDate === null) return true;
    return parseIsoCalendarDate(season.airDate) !== null && season.airDate <= todayIso;
  }).map((season) => season.seasonNumber));
}

export function deriveEpisodeMetadata(
  seasonNumber: number,
  episodes: EpisodeSummary[],
  todayIso: string,
): EpisodeMetadata | null {
  if (!isPositiveSafeInteger(seasonNumber) || !parseIsoCalendarDate(todayIso)) return null;
  const validEpisodes = episodes.filter((episode) => isPositiveSafeInteger(episode.episodeNumber));
  return {
    seasonNumber,
    knownEpisodeNumbers: sortedPositiveNumbers(validEpisodes.map((episode) => episode.episodeNumber)),
    trackableEpisodeNumbers: sortedPositiveNumbers(validEpisodes
      .filter((episode) => parseIsoCalendarDate(episode.airDate) !== null
        && String(episode.airDate) <= todayIso)
      .map((episode) => episode.episodeNumber)),
  };
}

export function findTvProgress(records: TvProgress[], tvId: number) {
  return records.find((record) => record.tvId === tvId) ?? null;
}

export function findEpisodeProgress(progress: TvProgress, seasonNumber: number) {
  return progress.episodeProgress.find((record) => record.seasonNumber === seasonNumber) ?? null;
}

export function synchronizeTrackingMetadata(
  records: TvProgress[],
  tvId: number,
  trackableSeasonNumbers: number[],
  episodeMetadata: EpisodeMetadata | null,
) {
  if (!isPositiveSafeInteger(tvId)) return normalizeTvProgress(records);
  const current = findTvProgress(records, tvId);
  const existingEpisodes = current?.episodeProgress ?? [];
  const existingForSeason = episodeMetadata && current
    ? findEpisodeProgress(current, episodeMetadata.seasonNumber) : null;
  const convertsWholeSeason = episodeMetadata
    ? current?.watchedSeasonNumbers.includes(episodeMetadata.seasonNumber) ?? false
    : false;
  const episodeProgress = episodeMetadata ? [
    ...existingEpisodes.filter((record) => record.seasonNumber !== episodeMetadata.seasonNumber),
    {
      ...episodeMetadata,
      knownEpisodeNumbers: sortedPositiveNumbers(episodeMetadata.knownEpisodeNumbers),
      trackableEpisodeNumbers: sortedPositiveNumbers(episodeMetadata.trackableEpisodeNumbers),
      watchedEpisodeNumbers: sortedPositiveNumbers([
        ...(existingForSeason?.watchedEpisodeNumbers ?? []),
        ...(convertsWholeSeason ? episodeMetadata.trackableEpisodeNumbers : []),
      ]),
    },
  ] : existingEpisodes;
  return normalizeTvProgress([
    ...records.filter((record) => record.tvId !== tvId),
    {
      tvId,
      trackableSeasonNumbers: sortedPositiveNumbers(trackableSeasonNumbers),
      watchedSeasonNumbers: episodeMetadata
        ? (current?.watchedSeasonNumbers ?? []).filter(
          (seasonNumber) => seasonNumber !== episodeMetadata.seasonNumber,
        )
        : current?.watchedSeasonNumbers ?? [],
      episodeProgress,
    },
  ]);
}

export function synchronizeTrackableSeasons(
  records: TvProgress[],
  tvId: number,
  trackableSeasonNumbers: number[],
) {
  return synchronizeTrackingMetadata(records, tvId, trackableSeasonNumbers, null);
}

export function setSeasonWatched(
  records: TvProgress[],
  tvId: number,
  seasonNumber: number,
  watched: boolean,
) {
  if (!isPositiveSafeInteger(tvId) || !isPositiveSafeInteger(seasonNumber)) return records;
  const current = findTvProgress(records, tvId) ?? {
    tvId, trackableSeasonNumbers: [], watchedSeasonNumbers: [], episodeProgress: [],
  };
  const watchedSeasonNumbers = watched
    ? [...current.watchedSeasonNumbers, seasonNumber]
    : current.watchedSeasonNumbers.filter((value) => value !== seasonNumber);
  return normalizeTvProgress([
    ...records.filter((record) => record.tvId !== tvId),
    { ...current, watchedSeasonNumbers: sortedPositiveNumbers(watchedSeasonNumbers) },
  ]);
}

export function setEpisodeWatched(
  records: TvProgress[],
  tvId: number,
  seasonNumber: number,
  episodeNumber: number,
  watched: boolean,
) {
  if (!isPositiveSafeInteger(tvId) || !isPositiveSafeInteger(seasonNumber)
    || !isPositiveSafeInteger(episodeNumber)) return records;
  const current = findTvProgress(records, tvId);
  if (!current) return records;
  const episode = findEpisodeProgress(current, seasonNumber);
  if (!episode?.trackableEpisodeNumbers.includes(episodeNumber)) return records;
  const watchedEpisodeNumbers = watched
    ? [...episode.watchedEpisodeNumbers, episodeNumber]
    : episode.watchedEpisodeNumbers.filter((value) => value !== episodeNumber);
  return normalizeTvProgress([
    ...records.filter((record) => record.tvId !== tvId),
    {
      ...current,
      episodeProgress: [
        ...current.episodeProgress.filter((record) => record.seasonNumber !== seasonNumber),
        { ...episode, watchedEpisodeNumbers: sortedPositiveNumbers(watchedEpisodeNumbers) },
      ],
    },
  ]);
}

export function setAiredEpisodesWatched(
  records: TvProgress[],
  tvId: number,
  seasonNumber: number,
  watched: boolean,
) {
  if (!isPositiveSafeInteger(tvId) || !isPositiveSafeInteger(seasonNumber)) return records;
  const current = findTvProgress(records, tvId);
  if (!current) return records;
  const episode = findEpisodeProgress(current, seasonNumber);
  if (!episode) return records;
  const trackable = new Set(episode.trackableEpisodeNumbers);
  const watchedEpisodeNumbers = watched
    ? [...episode.watchedEpisodeNumbers, ...episode.trackableEpisodeNumbers]
    : episode.watchedEpisodeNumbers.filter((number) => !trackable.has(number));
  return normalizeTvProgress([
    ...records.filter((record) => record.tvId !== tvId),
    {
      ...current,
      episodeProgress: [
        ...current.episodeProgress.filter((record) => record.seasonNumber !== seasonNumber),
        { ...episode, watchedEpisodeNumbers: sortedPositiveNumbers(watchedEpisodeNumbers) },
      ],
    },
  ]);
}

export function calculateEpisodeProgress(progress: EpisodeProgress) {
  const trackable = new Set(progress.trackableEpisodeNumbers);
  return {
    watched: progress.watchedEpisodeNumbers.filter((episode) => trackable.has(episode)).length,
    total: progress.trackableEpisodeNumbers.length,
  };
}

export function calculateTvProgress(progress: TvProgress) {
  const trackable = new Set(progress.trackableSeasonNumbers);
  const episodeTrackedSeasons = new Set(progress.episodeProgress.map((episode) => episode.seasonNumber));
  const completed = new Set(progress.watchedSeasonNumbers.filter(
    (season) => trackable.has(season) && !episodeTrackedSeasons.has(season),
  ));
  for (const episode of progress.episodeProgress) {
    if (!trackable.has(episode.seasonNumber) || episode.knownEpisodeNumbers.length === 0) continue;
    const trackableEpisodes = new Set(episode.trackableEpisodeNumbers);
    const watchedEpisodes = new Set(episode.watchedEpisodeNumbers);
    if (episode.knownEpisodeNumbers.every((number) => trackableEpisodes.has(number)
      && watchedEpisodes.has(number))) completed.add(episode.seasonNumber);
  }
  return { watched: completed.size, total: progress.trackableSeasonNumbers.length };
}

export async function commitTvProgressChange(
  previous: TvProgress[],
  write: () => Promise<TvProgress[]>,
) {
  try {
    return { saved: true as const, records: await write() };
  } catch {
    return { saved: false as const, records: previous };
  }
}
