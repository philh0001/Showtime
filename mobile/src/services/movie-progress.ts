import AsyncStorage from '@react-native-async-storage/async-storage';

import { createMovieProgressStorage } from './movie-progress-storage';

const movieProgressStorage = createMovieProgressStorage(AsyncStorage);

export const loadMovieProgress = movieProgressStorage.load;
export const markMovieWatched = movieProgressStorage.markWatched;
export const markMovieUnwatched = movieProgressStorage.markUnwatched;
