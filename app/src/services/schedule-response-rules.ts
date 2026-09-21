import { normalizeNextEpisode, type NextEpisode } from './air-date-rules.ts';
import type { ScheduleResponse } from './tv-schedule-rules.ts';

export function parseScheduleResponse(value: unknown, requestedId: number): ScheduleResponse | null {
  if (!value || typeof value !== 'object' || !('schedule' in value)) return null;
  const item = value.schedule;
  if (!item || typeof item !== 'object') return null;
  const schedule = item as Record<string, unknown>;
  if (schedule.id !== requestedId || typeof schedule.title !== 'string' || !schedule.title.trim()
    || schedule.title.length > 300 || (schedule.posterUrl !== null
      && (typeof schedule.posterUrl !== 'string'
        || !/^https:\/\/image\.tmdb\.org\/t\/p\/w500\/[\w.-]+$/.test(schedule.posterUrl)))
    || !['complete', 'partial'].includes(String(schedule.coverage))
    || !Array.isArray(schedule.episodes) || schedule.episodes.length > 200
    || !Array.isArray(schedule.seasonCoverage) || schedule.seasonCoverage.length > 100) return null;

  const seasons = new Set<number>();
  const seasonCoverage: ScheduleResponse['seasonCoverage'] = [];
  for (const part of schedule.seasonCoverage) {
    if (!part || !Number.isSafeInteger(part.seasonNumber) || part.seasonNumber <= 0
      || seasons.has(part.seasonNumber)
      || !['checked', 'unavailable', 'limited'].includes(part.status)) return null;
    seasons.add(part.seasonNumber);
    seasonCoverage.push({ seasonNumber: part.seasonNumber, status: part.status });
  }
  if (schedule.coverage === 'complete' && seasonCoverage.some((part) => part.status !== 'checked')) return null;

  const ids = new Set<number>();
  const slots = new Set<string>();
  const episodes: NextEpisode[] = [];
  for (const value of schedule.episodes) {
    const episode = normalizeNextEpisode(value, '0000-01-01');
    if (!episode || episode.seasonNumber <= 0 || !seasons.has(episode.seasonNumber)
      || ids.has(episode.id) || slots.has(`${episode.seasonNumber}:${episode.episodeNumber}`)) return null;
    ids.add(episode.id);
    slots.add(`${episode.seasonNumber}:${episode.episodeNumber}`);
    episodes.push(episode);
  }
  const nextEpisode = schedule.nextEpisode === null ? null
    : normalizeNextEpisode(schedule.nextEpisode, '0000-01-01');
  if (schedule.nextEpisode !== null && (!nextEpisode || nextEpisode.seasonNumber <= 0)) return null;
  return {
    id: requestedId, title: schedule.title.trim(), posterUrl: schedule.posterUrl as string | null,
    coverage: schedule.coverage as 'complete' | 'partial',
    seasonCoverage, episodes, nextEpisode,
  };
}
