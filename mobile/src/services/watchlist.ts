import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  addWatchlistItem,
  parseWatchlist,
  removeWatchlistItem,
  type WatchlistItem,
} from './watchlist-rules';

const WATCHLIST_KEY = '@showtime/watchlist';

export async function loadWatchlist() {
  const stored = await AsyncStorage.getItem(WATCHLIST_KEY);
  return parseWatchlist(stored);
}

export async function addToWatchlist(item: WatchlistItem) {
  const watchlist = addWatchlistItem(await loadWatchlist(), item);
  await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  return watchlist;
}

export async function removeFromWatchlist(
  id: number,
  mediaType: WatchlistItem['mediaType'],
) {
  const watchlist = removeWatchlistItem(await loadWatchlist(), id, mediaType);
  await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  return watchlist;
}
