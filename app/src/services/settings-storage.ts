export type SettingsResult = { status: 'available'; showTrending: boolean } | { status: 'unavailable' };
type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };
const SETTINGS_KEY = 'showtime.settings.v1';
export { SETTINGS_KEY };

export function createSettingsStorage(storage: Storage) {
  let pending: Promise<void> = Promise.resolve();
  async function read(): Promise<SettingsResult> {
    try {
      const stored = await storage.getItem(SETTINGS_KEY);
      if (stored === null) return { status: 'available', showTrending: true };
      const value = JSON.parse(stored);
      return value && typeof value.showTrending === 'boolean'
        ? { status: 'available', showTrending: value.showTrending } : { status: 'unavailable' };
    } catch { return { status: 'unavailable' }; }
  }
  return {
    async load() {
      await pending;
      return read();
    },
    setShowTrending(showTrending: boolean) {
      const write = pending.then(async () => {
        if ((await read()).status === 'unavailable') throw new Error('Settings unavailable.');
        await storage.setItem(SETTINGS_KEY, JSON.stringify({ showTrending }));
      });
      pending = write.catch(() => undefined);
      return write;
    },
  };
}
