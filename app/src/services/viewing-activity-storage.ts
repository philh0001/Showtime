import type { RecentlyViewedSnapshot } from './recently-viewed-rules.ts';
import { normalizeViewingActivity, parseViewingActivity, type ActivityLoadResult, type ViewingAction } from './viewing-activity-rules.ts';

export const ACTIVITY_KEY = 'showtime.viewing-activity.v1';
type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };

export function createViewingActivityStorage(storage: Storage, now = () => new Date().toISOString()) {
  let pending: Promise<void> = Promise.resolve();
  async function read(): Promise<ActivityLoadResult> {
    try { return parseViewingActivity(await storage.getItem(ACTIVITY_KEY)); }
    catch { return { status: 'unavailable' }; }
  }
  return {
    async load() { await pending; return read(); },
    record(title: RecentlyViewedSnapshot, action: ViewingAction) {
      const happenedAt = now();
      const write = pending.then(async () => {
        const loaded = await read();
        if (loaded.status === 'unavailable') throw new Error('Viewing history unavailable.');
        const sequence = loaded.records.reduce((max, item) => Math.max(max, item.sequence), 0) + 1;
        const id = globalThis.crypto?.randomUUID?.()
          ?? `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
        const event = normalizeViewingActivity({ id, sequence, title, action, happenedAt });
        if (!event) throw new Error('Invalid viewing activity.');
        await storage.setItem(ACTIVITY_KEY, JSON.stringify([event, ...loaded.records]));
      });
      pending = write.catch(() => undefined);
      return write;
    },
  };
}
