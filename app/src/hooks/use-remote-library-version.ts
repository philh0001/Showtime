import { useSyncExternalStore } from 'react';
import { getRemoteLibraryVersion, subscribeLibraryChanges } from '@/services/library-changes';

function subscribe(callback: () => void): () => void {
  return subscribeLibraryChanges((origin) => {
    if (origin === 'remote') callback();
  });
}

export function useRemoteLibraryVersion(): number {
  return useSyncExternalStore(subscribe, getRemoteLibraryVersion, () => 0);
}
