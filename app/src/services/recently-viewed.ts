import AsyncStorage from '@react-native-async-storage/async-storage';

import { createRecentlyViewedStorage } from './recently-viewed-storage';

const recentlyViewedStorage = createRecentlyViewedStorage(AsyncStorage);

export const loadRecentlyViewed = recentlyViewedStorage.load;
export const recordRecentlyViewed = recentlyViewedStorage.record;
