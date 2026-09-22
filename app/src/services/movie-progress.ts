import AsyncStorage from '@react-native-async-storage/async-storage';

import { createMovieProgressStorage } from './movie-progress-storage';
import { createNotifyingStorage } from './library-changes';

const movieProgressStorage = createMovieProgressStorage(createNotifyingStorage(AsyncStorage));

export const loadMovieProgress = movieProgressStorage.load;
export const markMovieWatched = movieProgressStorage.markWatched;
export const markMovieUnwatched = movieProgressStorage.markUnwatched;
