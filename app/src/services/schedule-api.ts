import { getServerUrl } from './server-url';
import { loadTvSchedules, mergeApiTvSchedule } from './tv-schedule';
import { createSavedScheduleRefresh } from './saved-schedule-refresh-rules';
import { fetchScheduleAt } from './schedule-http';

export const refreshSavedTvSchedules = createSavedScheduleRefresh({
  fetchSchedule: (id) => fetchScheduleAt(getServerUrl(), id),
  load: loadTvSchedules,
  save: mergeApiTvSchedule,
});
