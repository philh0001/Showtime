import type { SearchResult } from './search';

export type SearchState = {
  query: string;
  results: SearchResult[];
  status: 'idle' | 'loading' | 'success' | 'error';
  requestId: number;
  message: string | null;
};

export type SearchEvent =
  | { type: 'change'; query: string }
  | { type: 'submit'; requestId: number; query: string }
  | { type: 'success'; requestId: number; results: SearchResult[] }
  | { type: 'error'; requestId: number; message: string }
  | { type: 'clear' };

export const initialSearchState: SearchState = {
  query: '',
  results: [],
  status: 'idle',
  requestId: 0,
  message: null,
};

export function reduceSearchState(state: SearchState, event: SearchEvent): SearchState {
  if (event.type === 'clear') return initialSearchState;
  if (event.type === 'change') return { ...initialSearchState, query: event.query, requestId: state.requestId };
  if (event.type === 'submit') {
    return { query: event.query, results: [], status: 'loading', requestId: event.requestId, message: null };
  }
  if (event.requestId !== state.requestId) return state;
  if (event.type === 'success') return { ...state, status: 'success', results: event.results, message: null };
  return { ...state, status: 'error', results: [], message: event.message };
}
