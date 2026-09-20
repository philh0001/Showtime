import { parseTvSchedules, type ScheduleLoadResult, type TvSchedule } from './tv-schedule-rules.ts';

const SCHEDULE_KEY = 'showtime.tv-schedule.v1';
type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };

export function createTvScheduleStorage(storage: Storage) {
  let pending: Promise<unknown> = Promise.resolve();
  async function load(): Promise<ScheduleLoadResult> {
    try { return parseTvSchedules(await storage.getItem(SCHEDULE_KEY)); }
    catch { return { status: 'unavailable' }; }
  }
  return {
    load,
    record(snapshot: TvSchedule) {
      const write = pending.then(async () => {
        const current = await load();
        if (current.status === 'unavailable') throw new Error('Schedule cache unavailable.');
        const result = parseTvSchedules(JSON.stringify([snapshot, ...current.records]));
        if (result.status === 'unavailable') throw new Error('Invalid schedule.');
        await storage.setItem(SCHEDULE_KEY, JSON.stringify(result.records));
      });
      pending = write.catch(() => undefined);
      return write;
    },
  };
}
