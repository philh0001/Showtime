import { normalizeNextEpisode, selectNextEpisode, type NextEpisode } from './air-date-rules.ts';
import type { RecentlyViewedSnapshot } from './recently-viewed-rules.ts';
import { calculateEpisodeProgress, calculateTvProgress, type ProgressLoadResult } from './tv-progress-rules.ts';
import type { WatchlistItem } from './watchlist-rules.ts';

export type TvSchedule = RecentlyViewedSnapshot & {
  mediaType: 'TV'; checkedAt: string; nextEpisode: NextEpisode | null; episodes: NextEpisode[];
  apiCheckedAt?: string;
  coverage?: 'complete' | 'partial' | 'legacy';
  seasonCoverage?: { seasonNumber: number; status: 'checked' | 'unavailable' | 'limited' }[];
  staleSeasonNumbers?: number[];
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
  const seasonCoverage = Array.isArray(item.seasonCoverage) && item.seasonCoverage.length <= 100
    ? item.seasonCoverage.filter((part): part is NonNullable<TvSchedule['seasonCoverage']>[number] =>
      !!part && typeof part === 'object'
      && Number.isSafeInteger(part.seasonNumber) && part.seasonNumber > 0
      && ['checked', 'unavailable', 'limited'].includes(part.status)) : [];
  const apiCheckedAt = typeof item.apiCheckedAt === 'string'
    && Number.isFinite(Date.parse(item.apiCheckedAt))
    && new Date(item.apiCheckedAt).toISOString() === item.apiCheckedAt ? item.apiCheckedAt : undefined;
  return {
    id: Number(item.id), mediaType: 'TV', title: item.title.trim(), year: item.year as string | null,
    posterUrl: item.posterUrl as string | null, checkedAt: item.checkedAt,
    nextEpisode: normalizeNextEpisode(item.nextEpisode, '0000-01-01'),
    episodes: item.episodes.map((episode) => normalizeNextEpisode(episode, '0000-01-01'))
      .filter((episode): episode is NextEpisode => episode !== null && episode.seasonNumber > 0),
    apiCheckedAt,
    coverage: apiCheckedAt && ['complete', 'partial'].includes(String(item.coverage))
      ? item.coverage as 'complete' | 'partial' : 'legacy',
    seasonCoverage,
    staleSeasonNumbers: Array.isArray(item.staleSeasonNumbers)
      ? item.staleSeasonNumbers.filter((n): n is number => Number.isSafeInteger(n) && n > 0).slice(0, 100) : [],
  };
}

export type ScheduleResponse = {
  id: number; title: string; posterUrl: string | null; coverage: 'complete' | 'partial';
  nextEpisode: NextEpisode | null; episodes: NextEpisode[];
  seasonCoverage: NonNullable<TvSchedule['seasonCoverage']>;
};

export function mergeScheduleResponse(old: TvSchedule | undefined, incoming: ScheduleResponse, checkedAt: string): TvSchedule {
  const checked = new Set(incoming.seasonCoverage.filter((part) => part.status === 'checked').map((part) => part.seasonNumber));
  const limited = new Set(incoming.seasonCoverage.filter((part) => part.status === 'limited').map((part) => part.seasonNumber));
  const retained = incoming.coverage === 'complete' ? [] : (old?.episodes ?? []).filter((episode) =>
    !checked.has(episode.seasonNumber));
  const episodes = [...incoming.episodes];
  for (const episode of retained) {
    if (limited.has(episode.seasonNumber)) {
      const index = episodes.findIndex((newer) => newer.id === episode.id
        || (newer.seasonNumber === episode.seasonNumber && newer.episodeNumber === episode.episodeNumber));
      if (index !== -1) continue;
    }
    episodes.push(episode);
  }
  const unique = new Map<string, NextEpisode>();
  for (const episode of episodes) unique.set(`${episode.seasonNumber}:${episode.episodeNumber}`, episode);
  return {
    id: incoming.id, mediaType: 'TV', title: incoming.title,
    year: old?.year ?? null, posterUrl: incoming.posterUrl ?? old?.posterUrl ?? null,
    checkedAt, apiCheckedAt: checkedAt, coverage: incoming.coverage,
    seasonCoverage: incoming.seasonCoverage,
    staleSeasonNumbers: incoming.seasonCoverage.filter((part) => part.status !== 'checked')
      .map((part) => part.seasonNumber),
    nextEpisode: incoming.nextEpisode ?? (incoming.coverage === 'partial' && old?.nextEpisode
      && !checked.has(old.nextEpisode.seasonNumber) ? old.nextEpisode : null),
    episodes: [...unique.values()].sort((a, b) => a.airDate.localeCompare(b.airDate)
      || a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber),
  };
}

export type HomeScheduleRow = {
  id: number; title: string; posterUrl: string | null; date: string; episodes: NextEpisode[]; stale: boolean;
};

export function shouldShowTodayScheduleSection(view: {
  today: HomeScheduleRow[];
  weekDays: { rows: HomeScheduleRow[] }[];
  comingSoon: HomeScheduleRow[];
}): boolean {
  const hasLaterEpisodes = view.weekDays.some((day) => day.rows.length > 0) || view.comingSoon.length > 0;
  return view.today.length > 0 || !hasLaterEpisodes;
}

export function getHomeSchedule(records: TvSchedule[], savedTvIds: Set<number>, todayIso: string): {
  today: HomeScheduleRow[];
  weekDays: { date: string; rows: HomeScheduleRow[] }[];
  comingSoon: HomeScheduleRow[];
  coverage: 'complete' | 'partial';
} {
  const day = new Date(`${todayIso}T12:00:00Z`);
  const daysToSunday = 7 - (day.getUTCDay() || 7);
  day.setUTCDate(day.getUTCDate() + daysToSunday);
  const sunday = day.toISOString().slice(0, 10);
  const rows = new Map<string, HomeScheduleRow>();
  const selected = records.filter((record) => savedTvIds.has(record.id));
  for (const record of selected) {
    const bySlot = new Map<string, NextEpisode>();
    const seenIds = new Set<number>();
    for (const episode of [...record.episodes, record.nextEpisode].filter((value): value is NextEpisode => value !== null)) {
      if (episode.seasonNumber <= 0 || episode.airDate < todayIso) continue;
      const slot = `${episode.seasonNumber}:${episode.episodeNumber}`;
      if (seenIds.has(episode.id) || bySlot.has(slot)) continue;
      seenIds.add(episode.id);
      bySlot.set(slot, episode);
    }
    for (const episode of bySlot.values()) {
      const key = `${record.id}:${episode.airDate}`;
      const row = rows.get(key) ?? { id: record.id, title: record.title,
        posterUrl: record.posterUrl, date: episode.airDate, episodes: [], stale: false };
      row.episodes.push(episode);
      row.stale ||= record.staleSeasonNumbers?.includes(episode.seasonNumber) ?? false;
      rows.set(key, row);
    }
  }
  const sorted = [...rows.values()].map((row) => ({ ...row,
    episodes: row.episodes.sort((a, b) => a.seasonNumber - b.seasonNumber
      || a.episodeNumber - b.episodeNumber || a.id - b.id),
  })).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title) || a.id - b.id);
  const week = new Map<string, HomeScheduleRow[]>();
  for (const row of sorted.filter((row) => row.date > todayIso && row.date <= sunday)) {
    week.set(row.date, [...(week.get(row.date) ?? []), row]);
  }
  return {
    today: sorted.filter((row) => row.date === todayIso),
    weekDays: [...week].map(([date, dayRows]) => ({ date, rows: dayRows })),
    comingSoon: sorted.filter((row) => row.date > sunday),
    coverage: [...savedTvIds].every((id) => selected.some((record) =>
      record.id === id && record.coverage === 'complete' && !!record.apiCheckedAt)) ? 'complete' : 'partial',
  };
}

export function isFreshCompleteHomeSchedule(records: TvSchedule[], savedTvIds: Set<number>, nowMs: number): boolean {
  return savedTvIds.size > 0 && [...savedTvIds].every((id) => {
    const record = records.find((item) => item.id === id);
    const checkedAt = record?.apiCheckedAt ? Date.parse(record.apiCheckedAt) : NaN;
    // Home refreshes this clock once a minute; a result can land between ticks.
    return record?.coverage === 'complete' && Number.isFinite(checkedAt)
      && checkedAt <= nowMs + 60_000 && nowMs - checkedAt < 12 * 60 * 60 * 1000;
  });
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
