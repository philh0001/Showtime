import { normalizeNextEpisode, selectNextEpisode, type NextEpisode } from './air-date-rules.ts';
import type { RecentlyViewedSnapshot } from './recently-viewed-rules.ts';
import { calculateEpisodeProgress, calculateTvProgress, type ProgressLoadResult } from './tv-progress-rules.ts';
import type { WatchlistItem } from './watchlist-rules.ts';

export type TvSchedule = RecentlyViewedSnapshot & {
  mediaType: 'TV'; checkedAt: string; nextEpisode: NextEpisode | null; episodes: NextEpisode[];
};
export type ScheduleLoadResult = { status: 'available'; records: TvSchedule[] }
  | { status: 'unavailable' };
export type UpcomingItem = TvSchedule & { episode: NextEpisode };

function normalizeSchedule(value: unknown): TvSchedule | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (!Number.isSafeInteger(item.id) || Number(item.id) <= 0 || item.mediaType !== 'TV'
    || typeof item.title !== 'string' || !item.title.trim()
    || (item.year !== null && typeof item.year !== 'string')
    || (item.posterUrl !== null && typeof item.posterUrl !== 'string')
    || typeof item.checkedAt !== 'string' || !Number.isFinite(Date.parse(item.checkedAt))
    || new Date(item.checkedAt).toISOString() !== item.checkedAt || !Array.isArray(item.episodes)) return null;
  return {
    id: Number(item.id), mediaType: 'TV', title: item.title.trim(), year: item.year as string | null,
    posterUrl: item.posterUrl as string | null, checkedAt: item.checkedAt,
    nextEpisode: normalizeNextEpisode(item.nextEpisode, '0000-01-01'),
    episodes: item.episodes.map((episode) => normalizeNextEpisode(episode, '0000-01-01'))
      .filter((episode): episode is NextEpisode => episode !== null && episode.seasonNumber > 0),
  };
}

export function parseTvSchedules(stored: string | null): ScheduleLoadResult {
  if (stored === null) return { status: 'available', records: [] };
  try {
    const data: unknown = JSON.parse(stored);
    if (!Array.isArray(data)) return { status: 'unavailable' };
    const records = new Map<number, TvSchedule>();
    for (const value of data) {
      const item = normalizeSchedule(value);
      if (item && (!records.has(item.id) || records.get(item.id)!.checkedAt < item.checkedAt)) records.set(item.id, item);
    }
    return { status: 'available', records: [...records.values()].sort((a, b) => a.id - b.id) };
  } catch {
    return { status: 'unavailable' };
  }
}

export function getRelevantTvIds(watchlist: WatchlistItem[], progress: ProgressLoadResult): number[] {
  const included = new Set(watchlist.filter((item) => item.mediaType === 'TV').map((item) => item.id));
  const records = progress.status === 'available' ? progress.records : [];
  for (const record of records) {
    if (calculateTvProgress(record).watched > 0 || record.episodeProgress.some((item) =>
      record.trackableSeasonNumbers.includes(item.seasonNumber) && calculateEpisodeProgress(item).watched > 0)) included.add(record.tvId);
  }
  return [...included];
}

export function getUpcomingEpisodes(
  schedules: TvSchedule[], watchlist: WatchlistItem[], progress: ProgressLoadResult, todayIso: string,
): UpcomingItem[] {
  const included = new Set(getRelevantTvIds(watchlist, progress));
  const records = progress.status === 'available' ? progress.records : [];
  return schedules.flatMap((schedule): UpcomingItem[] => {
    if (!included.has(schedule.id)) return [];
    const record = records.find((item) => item.tvId === schedule.id);
    const unwatched = (episode: NextEpisode | null): episode is NextEpisode => {
      if (!episode || episode.seasonNumber <= 0) return false;
      const detailed = record?.episodeProgress.find((item) => item.seasonNumber === episode.seasonNumber);
      return detailed ? !detailed.watchedEpisodeNumbers.includes(episode.episodeNumber)
        : !record?.watchedSeasonNumbers.includes(episode.seasonNumber);
    };
    const episode = selectNextEpisode(unwatched(schedule.nextEpisode) ? schedule.nextEpisode : null,
      schedule.episodes.filter(unwatched), todayIso);
    return episode ? [{ ...schedule, episode }] : [];
  }).sort((a, b) => a.episode.airDate.localeCompare(b.episode.airDate) || a.title.localeCompare(b.title) || a.id - b.id);
}
