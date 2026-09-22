const MAX_RECENT_SEARCHES = 5;

function normalize(value: string) {
  return value.trim();
}

function uniqueSearches(values: unknown[]) {
  const seen = new Set<string>();
  const searches: string[] = [];

  for (const value of values) {
    if (typeof value !== 'string') continue;
    const search = normalize(value);
    const comparison = search.toLocaleLowerCase();
    if (!search || seen.has(comparison)) continue;
    seen.add(comparison);
    searches.push(search);
    if (searches.length === MAX_RECENT_SEARCHES) break;
  }

  return searches;
}

export function addRecentSearch(history: string[], query: string): string[] {
  const search = normalize(query);
  if (!search) return history;
  return uniqueSearches([search, ...history]);
}

export function filterRecentSearches(history: string[], query: string): string[] {
  const comparison = normalize(query).toLocaleLowerCase();
  if (!comparison) return history;
  return history.filter((search) => search.toLocaleLowerCase().includes(comparison));
}

export function parseRecentSearches(stored: string | null): string[] {
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? uniqueSearches(parsed) : [];
  } catch {
    return [];
  }
}
