import { mergeScheduleResponse, type ScheduleLoadResult, type ScheduleResponse, type TvSchedule } from './tv-schedule-rules.ts';
import type { WatchlistItem } from './watchlist-rules.ts';

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

type Dependencies = {
  fetchSchedule: (id: number) => Promise<ScheduleResponse>;
  load: () => Promise<ScheduleLoadResult>;
  save: (record: TvSchedule) => Promise<unknown>;
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
};
type Options = { force?: boolean; onUpdate?: (records: TvSchedule[]) => void;
  onFailure?: (id: number) => void };

export function createSavedScheduleRefresh(deps: Dependencies) {
  const now = deps.now ?? Date.now;
  const wait = deps.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const inFlight = new Map<number, Promise<boolean>>();
  const failedUntil = new Map<number, number>();
  const requestTimes: number[] = [];
  let pausedUntil = 0;
  let active = 0;

  function fresh(record: TvSchedule | undefined): boolean {
    if (!record?.apiCheckedAt || record.coverage === 'legacy') return false;
    const hasTemporaryGap = record.seasonCoverage?.some((part) => part.status === 'unavailable') ?? false;
    const age = now() - Date.parse(record.apiCheckedAt);
    return age >= 0 && age < (hasTemporaryGap ? 30 * MINUTE : 12 * HOUR);
  }

  async function acquire() {
    for (;;) {
      const clock = now();
      while (requestTimes.length && requestTimes[0] <= clock - MINUTE) requestTimes.shift();
      const delay = Math.max(pausedUntil - clock,
        requestTimes.length >= 6 ? requestTimes[0] + MINUTE - clock : 0);
      if (active < 2 && delay <= 0) {
        active += 1;
        requestTimes.push(clock);
        return;
      }
      await wait(Math.max(50, delay));
    }
  }

  async function requestOne(id: number): Promise<boolean> {
    for (let attempt = 0; attempt < 2; attempt++) {
      await acquire();
      try {
        const response = await deps.fetchSchedule(id);
        const current = await deps.load();
        if (current.status !== 'available') throw new Error('Schedule cache unavailable.');
        const old = current.records.find((record) => record.id === id);
        const merged = mergeScheduleResponse(old, response, new Date(now()).toISOString());
        await deps.save(merged);
        failedUntil.delete(id);
        return true;
      } catch (error) {
        if ((error as { status?: number })?.status === 429 && attempt === 0) {
          pausedUntil = Math.max(pausedUntil, now() + MINUTE);
        } else {
          failedUntil.set(id, now() + 15 * MINUTE);
          return false;
        }
      } finally {
        active -= 1;
      }
    }
    return false;
  }

  return async function refreshSavedTvSchedules(watchlist: WatchlistItem[], options: Options = {}) {
    const initial = await deps.load();
    if (initial.status !== 'available') return { records: [] as TvSchedule[], failedIds: [] as number[], attempted: 0 };
    const savedIds = [...new Set(watchlist.filter((item) => item.mediaType === 'TV').map((item) => item.id))];
    const failedIds = new Set<number>();
    if (!options.force) for (const id of savedIds) {
      if (now() < (failedUntil.get(id) ?? 0) && !inFlight.has(id)) {
        failedIds.add(id);
        options.onFailure?.(id);
      }
    }
    const targets = savedIds.filter((id) => {
      if (inFlight.has(id)) return true;
      if (now() < (failedUntil.get(id) ?? 0) && !options.force) return false;
      return options.force || !fresh(initial.records.find((record) => record.id === id));
    });
    let cursor = 0;
    async function worker() {
      while (cursor < targets.length) {
        const id = targets[cursor++];
        let pending = inFlight.get(id);
        if (!pending) {
          if (!options.force) {
            if (now() < (failedUntil.get(id) ?? 0)) {
              failedIds.add(id);
              options.onFailure?.(id);
              continue;
            }
            const latest = await deps.load();
            if (latest.status === 'available' && fresh(latest.records.find((record) => record.id === id))) {
              options.onUpdate?.(latest.records);
              continue;
            }
          }
          pending = inFlight.get(id);
          if (!pending) {
            pending = requestOne(id);
            inFlight.set(id, pending);
            void pending.then(() => { if (inFlight.get(id) === pending) inFlight.delete(id); },
              () => { if (inFlight.get(id) === pending) inFlight.delete(id); });
          }
        }
        if (!(await pending)) {
          failedIds.add(id);
          options.onFailure?.(id);
        }
        else if (options.onUpdate) {
          const updated = await deps.load();
          if (updated.status === 'available') options.onUpdate(updated.records);
        }
      }
    }
    await Promise.all([worker(), worker()]);
    const final = await deps.load();
    return { records: final.status === 'available' ? final.records : initial.records,
      failedIds: [...failedIds], attempted: targets.length };
  };
}
