import { getServerUrl } from './server-url';
import { normalizeDetailExtras, type DetailExtras } from './detail-extras-rules';
import { normalizePersonDetails, type PersonDetails } from './person-details-rules';
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
  watchProviders: WatchProviders;
  seasons: {
    id: number;
    name: string;
    seasonNumber: number;
    episodeCount: number | null;
    airDate: string | null;
  }[];
};

export type WatchProvider = {
  id: number;
  name: string;
  logoUrl: string | null;
  offers: 'stream' | 'rent' | 'buy';
};
export type WatchProviders = {
  status: 'available' | 'none' | 'unavailable';
  region: 'GB';
  link: string | null;
  providers: WatchProvider[];
};

export type EpisodeSummary = Omit<NextEpisode, 'airDate'> & { airDate: string | null };
export type LatestSeason = {
  seasonNumber: number;
  name: string;
  episodes: EpisodeSummary[];
};

export class DetailsError extends Error {}

export async function fetchPersonDetails(id: number, signal: AbortSignal): Promise<PersonDetails> {
  const endpoint = `${getServerUrl()}/details/person/${encodeURIComponent(id)}`;
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
      ? 'This person could not be found.'
      : response.status === 429
        ? 'Please wait a moment and try again.'
        : 'Person details are temporarily unavailable. Please try again.');
  }
  try {
    const { person } = await response.json();
    const normalized = normalizePersonDetails(person, id);
    if (!normalized) throw new Error('Invalid person');
    return normalized;
  } catch (error) {
    logDetailsFailure(endpoint, response.status, error);
    throw new DetailsError('Could not read this person. Please try again.');
  }
}

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

function normalizeSeason(value: unknown): LatestSeason | null {
  return normalizeLatestSeason(value);
}

function normalizeWatchProviders(value: unknown): WatchProviders {
  if (!value || typeof value !== 'object') return { status: 'unavailable', region: 'GB', link: null, providers: [] };
  const source = value as Record<string, unknown>;
  const providers = Array.isArray(source.providers) ? source.providers.flatMap((item): WatchProvider[] => {
    if (!item || typeof item !== 'object') return [];
    const provider = item as Record<string, unknown>;
    if (!Number.isSafeInteger(provider.id) || Number(provider.id) <= 0
      || typeof provider.name !== 'string' || !provider.name.trim()
      || !['stream', 'rent', 'buy'].includes(String(provider.offers))) return [];
    return [{
      id: Number(provider.id),
      name: provider.name.trim(),
      logoUrl: typeof provider.logoUrl === 'string' && /^https:\/\/image\.tmdb\.org\/t\/p\/[\w./-]+$/.test(provider.logoUrl)
        ? provider.logoUrl : null,
      offers: provider.offers as WatchProvider['offers'],
    }];
  }) : [];
  const status = source.status === 'available' || source.status === 'none' || source.status === 'unavailable'
    ? source.status : providers.length ? 'available' : 'unavailable';
  return {
    status,
    region: 'GB',
    link: typeof source.link === 'string' && /^https:\/\/www\.themoviedb\.org\/.+/.test(source.link) ? source.link : null,
    providers,
  };
}

export async function fetchSeasonEpisodes(
  tvId: number,
  seasonNumber: number,
  signal: AbortSignal,
): Promise<LatestSeason> {
  const endpoint = `${getServerUrl()}/details/tv/${encodeURIComponent(tvId)}/season/${encodeURIComponent(seasonNumber)}`;
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
      ? 'This season could not be found.'
      : response.status === 429
        ? 'Please wait a moment and try again.'
        : 'Season details are temporarily unavailable. Please try again.');
  }
  try {
    const { season } = await response.json();
    const normalized = normalizeSeason(season);
    if (!normalized || normalized.seasonNumber !== seasonNumber) throw new Error('Invalid season');
    return normalized;
  } catch (error) {
    logDetailsFailure(endpoint, response.status, error);
    throw new DetailsError('Could not read this season. Please try again.');
  }
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
    watchProviders: normalizeWatchProviders(details.watchProviders),
    latestSeason,
    nextEpisode: selectNextEpisode(details.nextEpisode, latestSeason?.episodes ?? [], todayIso),
  };
}
