import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard } from 'react-native';

import { searchTitles, type SearchResult } from './search';
import { clearRecentSearches, loadRecentSearches, recordRecentSearch } from './search-history';
import { filterRecentSearches } from './search-history-rules';
import { initialSearchState, reduceSearchState, type SearchState } from './search-state';

export type SearchControllerOptions = {
  onSearch?: (query: string, signal: AbortSignal) => Promise<SearchResult[]>;
};

export function useSearchController(options: SearchControllerOptions = {}) {
  const [state, setState] = useState<SearchState>(initialSearchState);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const activeRequest = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    let active = true;
    loadRecentSearches()
      .then((searches) => {
        if (active) setRecentSearches(searches);
      })
      .catch(() => {
        // Search history is optional and should not block search.
      });
    return () => {
      active = false;
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, []);

  const changeQuery = useCallback((value: string) => {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setState((current) => reduceSearchState(current, { type: 'change', query: value }));
  }, []);

  const clear = useCallback(() => {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setState((current) => reduceSearchState(current, { type: 'clear' }));
  }, []);

  const submit = useCallback(async (value = state.query) => {
    const nextQuery = value.trim();
    if (!nextQuery) return;

    const requestId = ++requestIdRef.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setState((current) => reduceSearchState(current, { type: 'submit', requestId, query: nextQuery }));
    Keyboard.dismiss();

    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const searchFn = options.onSearch ?? searchTitles;
      const matches = await searchFn(nextQuery, controller.signal);
      if (activeRequest.current !== controller) return;
      setState((current) => reduceSearchState(current, { type: 'success', requestId, results: matches }));
      const updated = await recordRecentSearch(nextQuery).catch(() => null);
      if (updated) setRecentSearches(updated);
    } catch {
      if (activeRequest.current !== controller) return;
      setState((current) => reduceSearchState(current, {
        type: 'error',
        requestId,
        message: 'Could not load results. Check your connection and try again.',
      }));
    } finally {
      clearTimeout(timeout);
      if (activeRequest.current === controller) {
        activeRequest.current = null;
      }
    }
  }, [options, state.query]);

  const clearHistory = useCallback(() => {
    setRecentSearches([]);
    clearRecentSearches().catch(() => {
      // The in-memory list can still be cleared even if storage fails.
    });
  }, []);

  const suggestions = useMemo(() => filterRecentSearches(recentSearches, state.query), [recentSearches, state.query]);

  return {
    query: state.query,
    results: state.results,
    status: state.status,
    message: state.message,
    requestId: state.requestId,
    recentSearches,
    suggestions,
    changeQuery,
    clear,
    clearHistory,
    submit,
  };
}
