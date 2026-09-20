import { getServerUrl } from './server-url';
import { normalizeDetailExtras, type DetailExtras } from './detail-extras-rules';
import {
  getDeviceLocalIsoDate,
  parseIsoCalendarDate,
  selectNextEpisode,
  type NextEpisode,
} from './air-date-rules';

export type MediaType = 'movie' | 'tv';
export type MediaDetails = DetailExtras & {
  id: number;
  mediaType: 'Movie' | 'TV';
  title: string;
  overview: string | null;
  releaseDate: string | null;
  rating: number | null;
  genres: string[];
  posterUrl: string | null;
  backdropUrl: string | null;
  nextEpisode: NextEpisode | null;
  latestSeason: LatestSeason | null;
  seasons: {
    id: number;
    name: string;
    seasonNumber: number;
    episodeCount: number | null;
    airDate: string | null;
  }[];
};

export type EpisodeSummary = Omit<NextEpisode, 'airDate'> & { airDate: string | null };
export type LatestSeason = {
  seasonNumber: number;
  name: string;
  episodes: EpisodeSummary[];
};

export class DetailsError extends Error {}

function logDetailsFailure(endpoint: string, status: number | null, error?: unknown) {
  if (!__DEV__) return;
  console.error('[details] request failed', {
    endpoint,
    status,
    error: error instanceof Error ? error.name : null,
  });
}

function normalizeLatestSeason(value: unknown): LatestSeason | null {
  if (!value || typeof value !== 'object') return null;
  const season = value as Record<string, unknown>;
  if (!Number.isSafeInteger(season.seasonNumber) || Number(season.seasonNumber) <= 0
    || !Array.isArray(season.episodes)) return null;
  const seasonNumber = Number(season.seasonNumber);
  const episodes = season.episodes.flatMap((value): EpisodeSummary[] => {
    if (!value || typeof value !== 'object') return [];
    const episode = value as Record<string, unknown>;
    const airDate = episode.airDate === null
      ? null
      : parseIsoCalendarDate(episode.airDate) ? String(episode.airDate) : undefined;
    if (!Number.isSafeInteger(episode.id) || Number(episode.id) <= 0
      || episode.seasonNumber !== seasonNumber
      || !Number.isInteger(episode.episodeNumber) || Number(episode.episodeNumber) <= 0
      || airDate === undefined) return [];
    return [{
      id: Number(episode.id),
      name: typeof episode.name === 'string' && episode.name.trim() ? episode.name.trim() : null,
      seasonNumber,
      episodeNumber: Number(episode.episodeNumber),
      airDate,
    }];
  }).sort((a, b) => a.episodeNumber - b.episodeNumber || a.id - b.id);
  return {
    seasonNumber,
    name: typeof season.name === 'string' && season.name.trim()
      ? season.name.trim() : `Season ${seasonNumber}`,
    episodes,
  };
}

export async function fetchDetails(mediaType: MediaType, id: string, signal: AbortSignal): Promise<MediaDetails> {
  const endpoint = `${getServerUrl()}/details/${mediaType}/${encodeURIComponent(id)}`;
  let response: Response;
  try {
    response = await fetch(endpoint, { signal });
  } catch (error) {
    logDetailsFailure(endpoint, null, error);
    throw error;
  }
  if (!response.ok) {
    logDetailsFailure(endpoint, response.status);
    throw new DetailsError(response.status === 404
      ? 'This title could not be found.'
      : response.status === 429
        ? 'Please wait a moment and try again.'
        : 'Details are temporarily unavailable. Please try again.');
  }
  let details;
  try {
    ({ details } = await response.json());
  } catch (error) {
    logDetailsFailure(endpoint, response.status, error);
    throw new DetailsError('Could not read this title. Please try again.');
  }
  if (!details || details.id !== Number(id) || typeof details.title !== 'string'
    || !Array.isArray(details.genres) || !Array.isArray(details.seasons)) {
    throw new DetailsError('Could not read this title. Please try again.');
  }
  const todayIso = getDeviceLocalIsoDate();
  const latestSeason = normalizeLatestSeason(details.latestSeason);
  return {
    ...details,
    ...normalizeDetailExtras(details),
    latestSeason,
    nextEpisode: selectNextEpisode(details.nextEpisode, latestSeason?.episodes ?? [], todayIso),
  };
}
