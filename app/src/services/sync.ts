import AsyncStorage from '@react-native-async-storage/async-storage';

import { syncPull, syncPush } from './account-api';
import { WATCHLIST_KEY } from './watchlist';
import { MOVIE_PROGRESS_KEY } from './movie-progress-storage';
import { TV_PROGRESS_KEY } from './tv-progress-storage';
import { ACTIVITY_KEY } from './viewing-activity-storage';
import { SETTINGS_KEY } from './settings-storage';
import { createSyncEngine, type SyncOutcome } from './sync-engine';

export type { SyncOutcome };

const engine = createSyncEngine(AsyncStorage, { pull: syncPull, push: syncPush }, {
  watchlist: WATCHLIST_KEY,
  'movie-progress': MOVIE_PROGRESS_KEY,
  'tv-progress': TV_PROGRESS_KEY,
  'viewing-activity': ACTIVITY_KEY,
  settings: SETTINGS_KEY,
});

export function runSync(sessionToken: string, userId: string): Promise<SyncOutcome> {
  return engine.run(sessionToken, userId);
}
