import { getServerUrl } from './server-url';

export type MediaType = 'movie' | 'tv';
export type MediaDetails = {
  id: number;
  mediaType: 'Movie' | 'TV';
  title: string;
  overview: string | null;
  releaseDate: string | null;
  rating: number | null;
  genres: string[];
  posterUrl: string | null;
  backdropUrl: string | null;
  seasons: {
    id: number;
    name: string;
    seasonNumber: number;
    episodeCount: number | null;
    airDate: string | null;
  }[];
};

export class DetailsError extends Error {}

export async function fetchDetails(mediaType: MediaType, id: string, signal: AbortSignal): Promise<MediaDetails> {
  const response = await fetch(`${getServerUrl()}/details/${mediaType}/${encodeURIComponent(id)}`, { signal });
  if (!response.ok) {
    throw new DetailsError(response.status === 404
      ? 'This title could not be found.'
      : response.status === 429
        ? 'Please wait a moment and try again.'
        : 'Details are temporarily unavailable. Please try again.');
  }
  const { details } = await response.json();
  if (!details || details.id !== Number(id) || typeof details.title !== 'string'
    || !Array.isArray(details.genres) || !Array.isArray(details.seasons)) {
    throw new DetailsError('Could not read this title. Please try again.');
  }
  return details;
}
