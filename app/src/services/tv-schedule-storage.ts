import { parseTvSchedules, type ScheduleLoadResult, type TvSchedule } from './tv-schedule-rules.ts';

const SCHEDULE_KEY = 'showtime.tv-schedule.v1';
type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };

export function createTvScheduleStorage(storage: Storage) {
  let pending: Promise<unknown> = Promise.resolve();
  async function load(): Promise<ScheduleLoadResult> {
    try { return parseTvSchedules(await storage.getItem(SCHEDULE_KEY)); }
    catch { return { status: 'unavailable' }; }
  }
  function writeSnapshot(snapshot: TvSchedule, onlyIfMissing: boolean) {
      const write = pending.then(async () => {
        const current = await load();
        if (current.status === 'unavailable') throw new Error('Schedule cache unavailable.');
        if (onlyIfMissing && current.records.some((item) => item.id === snapshot.id)) return;
        const result = parseTvSchedules(JSON.stringify([snapshot,
          ...current.records.filter((record) => record.id !== snapshot.id)]));
        if (result.status === 'unavailable') throw new Error('Invalid schedule.');
        await storage.setItem(SCHEDULE_KEY, JSON.stringify(result.records));
      });
      pending = write.catch(() => undefined);
      return write;
  }
  return {
    load,
    record: (snapshot: TvSchedule) => writeSnapshot(snapshot, false),
    mergeApi: (snapshot: TvSchedule) => writeSnapshot(snapshot, false),
    seedIfMissing: (snapshot: TvSchedule) => writeSnapshot(snapshot, true),
  };
}
