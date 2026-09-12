import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type SearchResult = {
  id: string;
  title: string;
  year: string | null;
  mediaType: 'Movie' | 'TV';
  posterUrl: string | null;
};

function getServerUrl() {
  const configured = process.env.EXPO_PUBLIC_SEARCH_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const hostUri = Constants.expoConfig?.hostUri;
  if (__DEV__ && hostUri) return `http://${new URL(`http://${hostUri}`).hostname}:3001`;
  if (__DEV__ && Platform.OS === 'web') return 'http://localhost:3001';
  throw new Error('Search is not available yet.');
}

export async function searchTitles(query: string, signal: AbortSignal): Promise<SearchResult[]> {
  const url = `${getServerUrl()}/search?query=${encodeURIComponent(query.trim())}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Search is temporarily unavailable.');
  const data = await response.json();
  if (!Array.isArray(data.results)) throw new Error('Unexpected search response.');
  return data.results;
}
