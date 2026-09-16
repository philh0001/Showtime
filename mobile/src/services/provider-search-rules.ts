const providerSiteUrls: Record<string, string> = {
  'amazon prime video': 'https://www.primevideo.com/',
  netflix: 'https://www.netflix.com/gb/',
  'paramount+': 'https://www.paramountplus.com/gb/',
  'disney+': 'https://www.disneyplus.com/en-gb/',
  'apple tv': 'https://tv.apple.com/gb/',
  'sky store': 'https://www.skystore.com/',
  itvx: 'https://www.itv.com/',
};

/**
 * Returns an allowlisted provider website. Unknown providers deliberately
 * have no link rather than interpolating an untrusted provider name into a URL.
 */
export function getProviderSearchUrl(providerName: string, title: string): string | null {
  const normalizedProvider = providerName.trim().toLowerCase();
  if (!title.trim()) return null;
  return providerSiteUrls[normalizedProvider] ?? null;
}
