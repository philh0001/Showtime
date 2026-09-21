type ChangeOrigin = 'local' | 'remote';
type Listener = (origin: ChangeOrigin) => void;
type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const listeners = new Set<Listener>();
let remoteVersion = 0;

export function getRemoteLibraryVersion(): number { return remoteVersion; }

export function subscribeLibraryChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function publishLibraryChange(origin: ChangeOrigin): void {
  if (origin === 'remote') remoteVersion += 1;
  for (const listener of listeners) listener(origin);
}

export function createNotifyingStorage(storage: Storage): Storage {
  return {
    getItem: (key) => storage.getItem(key),
    async setItem(key, value) {
      await storage.setItem(key, value);
      publishLibraryChange('local');
    },
    async removeItem(key) {
      await storage.removeItem(key);
      publishLibraryChange('local');
    },
  };
}
