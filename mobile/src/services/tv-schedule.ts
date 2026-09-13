import AsyncStorage from '@react-native-async-storage/async-storage';
import { createTvScheduleStorage } from './tv-schedule-storage';
import { normalizeNextEpisode } from './air-date-rules';
import type { MediaDetails } from './details';

const storage = createTvScheduleStorage(AsyncStorage);
export const loadTvSchedules = storage.load;

export async function recordTvSchedule(details: MediaDetails) {
  if (details.mediaType !== 'TV') return;
  return storage.record({
    id: details.id, mediaType: 'TV', title: details.title,
    year: details.releaseDate?.slice(0, 4) ?? null, posterUrl: details.posterUrl,
    checkedAt: new Date().toISOString(), nextEpisode: details.nextEpisode,
    episodes: (details.latestSeason?.episodes ?? []).flatMap((episode) => {
      const normalized = normalizeNextEpisode(episode, '0000-01-01');
      return normalized ? [normalized] : [];
    }),
  });
}
