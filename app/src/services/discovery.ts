import { createDiscoveryCache } from './discovery-cache';
import { getServerUrl } from './server-url';

const cache = createDiscoveryCache(async () => {
  const response = await fetch(`${getServerUrl()}/discovery`, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('Discovery is temporarily unavailable.');
  return response.json();
});

export const loadDiscovery = cache.load;
