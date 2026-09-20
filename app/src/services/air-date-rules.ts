export type CalendarDate = { year: number; month: number; day: number };
export type NextEpisode = {
  id: number;
  name: string | null;
  seasonNumber: number;
  episodeNumber: number;
  airDate: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const NO_UPCOMING_EPISODE = 'No upcoming episode announced';

export function parseIsoCalendarDate(value: unknown): CalendarDate | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day ? { year, month, day } : null;
}

function calendarDayIndex(date: CalendarDate) {
  const value = new Date(0);
  value.setUTCFullYear(date.year, date.month - 1, date.day);
  value.setUTCHours(0, 0, 0, 0);
  return Math.floor(value.getTime() / DAY_MS);
}

export function formatUkDate(value: string | null) {
  const date = parseIsoCalendarDate(value);
  return date
    ? `${String(date.day).padStart(2, '0')}/${String(date.month).padStart(2, '0')}/${date.year}`
    : null;
}

export function getDeviceLocalIsoDate(now = new Date()) {
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function getCountdownLabel(airDate: string | null, todayIso = getDeviceLocalIsoDate()) {
  const target = parseIsoCalendarDate(airDate);
  const today = parseIsoCalendarDate(todayIso);
  if (!target || !today) return NO_UPCOMING_EPISODE;
  const days = calendarDayIndex(target) - calendarDayIndex(today);
  if (days < 0) return NO_UPCOMING_EPISODE;
  if (days === 0) return 'Airs today';
  if (days === 1) return 'Airs tomorrow';
  return `Airs in ${days} days`;
}

export function getSeasonAirDateLabel(airDate: string | null, todayIso = getDeviceLocalIsoDate()) {
  const seasonDate = parseIsoCalendarDate(airDate);
  const today = parseIsoCalendarDate(todayIso);
  const formatted = formatUkDate(airDate);
  if (!seasonDate || !today || !formatted) return 'Air date unavailable';
  return calendarDayIndex(seasonDate) > calendarDayIndex(today)
    ? `Starts ${formatted}`
    : `Premiered ${formatted}`;
}

export function normalizeNextEpisode(value: unknown, todayIso = getDeviceLocalIsoDate()): NextEpisode | null {
  if (!value || typeof value !== 'object') return null;
  const episode = value as Record<string, unknown>;
  const airDate = typeof episode.airDate === 'string' ? episode.airDate : null;
  const countdown = getCountdownLabel(airDate, todayIso);
  if (!Number.isSafeInteger(episode.id) || Number(episode.id) <= 0
    || !Number.isInteger(episode.seasonNumber) || Number(episode.seasonNumber) < 0
    || !Number.isInteger(episode.episodeNumber) || Number(episode.episodeNumber) <= 0
    || countdown === NO_UPCOMING_EPISODE) return null;
  const name = typeof episode.name === 'string' && episode.name.trim() ? episode.name.trim() : null;
  return {
    id: Number(episode.id),
    name,
    seasonNumber: Number(episode.seasonNumber),
    episodeNumber: Number(episode.episodeNumber),
    airDate: airDate!,
  };
}

export function selectNextEpisode(
  primary: unknown,
  candidates: unknown[],
  todayIso = getDeviceLocalIsoDate(),
) {
  const normalizedPrimary = normalizeNextEpisode(primary, todayIso);
  if (normalizedPrimary) return normalizedPrimary;
  return candidates
    .map((candidate) => normalizeNextEpisode(candidate, todayIso))
    .filter((candidate): candidate is NextEpisode => candidate !== null)
    .sort((a, b) => a.airDate.localeCompare(b.airDate)
      || a.seasonNumber - b.seasonNumber
      || a.episodeNumber - b.episodeNumber
      || a.id - b.id)[0] ?? null;
}
