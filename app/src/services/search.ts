import { getServerUrl } from './server-url';

export type SearchResult = {
  id: string;
  title: string;
  year: string | null;
  mediaType: 'Movie' | 'TV';
  posterUrl: string | null;
};

export async function searchTitles(query: string, signal: AbortSignal): Promise<SearchResult[]> {
  const url = `${getServerUrl()}/search?query=${encodeURIComponent(query.trim())}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Search is temporarily unavailable.');
  const data = await response.json();
  if (!Array.isArray(data.results)) throw new Error('Unexpected search response.');
  return data.results;
}
