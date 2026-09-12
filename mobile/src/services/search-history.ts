import AsyncStorage from '@react-native-async-storage/async-storage';

import { addRecentSearch, parseRecentSearches } from './search-history-rules';

const RECENT_SEARCHES_KEY = '@showtime/recent-searches';

export async function loadRecentSearches() {
  const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
  return parseRecentSearches(stored);
}

export async function recordRecentSearch(query: string) {
  const searches = await loadRecentSearches();
  const updated = addRecentSearch(searches, query);
  await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  return updated;
}

export async function clearRecentSearches() {
  await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
}
