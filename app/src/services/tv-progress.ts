import AsyncStorage from '@react-native-async-storage/async-storage';

import { createTvProgressStorage } from './tv-progress-storage';

const progressStorage = createTvProgressStorage(AsyncStorage);

export const loadTvProgress = progressStorage.load;
export const synchronizeTvProgress = progressStorage.synchronize;
export const synchronizeTvTracking = progressStorage.synchronizeTracking;
export const setTvSeasonWatched = progressStorage.setSeasonWatched;
export const setTvEpisodeWatched = progressStorage.setEpisodeWatched;
export const setTvAiredEpisodesWatched = progressStorage.setAiredEpisodesWatched;
