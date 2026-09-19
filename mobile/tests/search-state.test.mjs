import assert from 'node:assert/strict';
import test from 'node:test';

import { initialSearchState, reduceSearchState } from '../src/services/search-state.ts';

const batman = { id: 'movie-268', title: 'Batman', year: '1989', mediaType: 'Movie', posterUrl: null };

test('query changes clear stale results and submit tracks one request', () => {
  const changed = reduceSearchState(initialSearchState, { type: 'change', query: ' Batman ' });
  assert.deepEqual(changed, { ...initialSearchState, query: ' Batman ' });
  const loading = reduceSearchState(changed, { type: 'submit', requestId: 3, query: 'Batman' });
  assert.equal(loading.status, 'loading');
  assert.equal(loading.requestId, 3);
  assert.equal(loading.query, 'Batman');
});

test('only the active request may publish results or errors', () => {
  const loading = { query: 'Batman', results: [], status: 'loading', requestId: 3, message: null };
  assert.equal(reduceSearchState(loading, { type: 'success', requestId: 2, results: [batman] }), loading);
  assert.equal(reduceSearchState(loading, { type: 'error', requestId: 2, message: 'Stale error.' }), loading);
  assert.deepEqual(
    reduceSearchState(loading, { type: 'success', requestId: 3, results: [batman] }),
    { query: 'Batman', results: [batman], status: 'success', requestId: 3, message: null },
  );
});

test('clear closes inline results and retry preserves the query', () => {
  const error = { query: 'Batman', results: [], status: 'error', requestId: 4, message: 'Search failed.' };
  assert.deepEqual(reduceSearchState(error, { type: 'clear' }), initialSearchState);
  assert.equal(reduceSearchState(error, { type: 'submit', requestId: 5, query: 'Batman' }).query, 'Batman');
});
