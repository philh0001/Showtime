import type { MediaDetails } from './details.ts';
import { getRelevantTvIds, type ScheduleLoadResult } from './tv-schedule-rules.ts';
import type { ProgressLoadResult } from './tv-progress-rules.ts';
import type { WatchlistItem } from './watchlist-rules.ts';

const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;
const FAILURE_RETRY_MS = 5 * 60 * 1000;
const MAX_FETCHES_PER_VISIT = 8;

type ScheduleContext = {
  watchlist: WatchlistItem[];
  progress: ProgressLoadResult;
  cache: ScheduleLoadResult;
  nowMs: number;
};

type RefreshContext = ScheduleContext & { signal: AbortSignal; force?: boolean };

type Dependencies = {
  fetchTvDetails: (id: number, signal: AbortSignal) => Promise<MediaDetails>;
  recordTvSchedule: (details: MediaDetails) => Promise<unknown>;
  loadTvSchedules: () => Promise<ScheduleLoadResult>;
};

export function selectScheduleIdsToRefresh({ watchlist, progress, cache, nowMs }: ScheduleContext): number[] {
  if (cache.status !== 'available') return [];
  const stored = new Map(cache.records.map((record) => [record.id, record]));
  return getRelevantTvIds(watchlist, progress)
    .filter((id) => {
      const checkedAt = stored.get(id)?.checkedAt;
      return !checkedAt || nowMs - Date.parse(checkedAt) >= REFRESH_AFTER_MS;
    });
}

export function createHomeScheduleRefresh(dependencies: Dependencies) {
  const failedAt = new Map<number, number>();
  return async function refresh(context: RefreshContext): Promise<{ cache: ScheduleLoadResult; attempted: number; failed: number }> {
    if (context.signal.aborted) return { cache: context.cache, attempted: 0, failed: 0 };
    const targets = selectScheduleIdsToRefresh(context)
      .filter((id) => context.force || context.nowMs - (failedAt.get(id) ?? -Infinity) >= FAILURE_RETRY_MS)
      .slice(0, MAX_FETCHES_PER_VISIT);
    if (targets.length === 0) return { cache: context.cache, attempted: 0, failed: 0 };

    let next = 0;
    let failed = 0;
    async function worker() {
      while (next < targets.length && !context.signal.aborted) {
        const id = targets[next++];
        try {
          const details = await dependencies.fetchTvDetails(id, context.signal);
          if (context.signal.aborted) return;
          await dependencies.recordTvSchedule(details);
          failedAt.delete(id);
        } catch {
          if (!context.signal.aborted) {
            failed += 1;
            failedAt.set(id, context.nowMs);
          }
        }
      }
    }
    await Promise.all([worker(), worker()]);
    if (context.signal.aborted) return { cache: context.cache, attempted: targets.length, failed };
    return { cache: await dependencies.loadTvSchedules(), attempted: targets.length, failed };
  };
}
