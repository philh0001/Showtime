import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addRecentSearch,
  filterRecentSearches,
  parseRecentSearches,
} from '../src/services/search-history-rules.ts';

test('adds a trimmed search to the front and keeps the five newest searches', () => {
  const history = ['Five', 'Four', 'Three', 'Two', 'One'];

  assert.deepEqual(addRecentSearch(history, '  Six  '), [
    'Six', 'Five', 'Four', 'Three', 'Two',
  ]);
});

test('moves a reused search to the front without a case-insensitive duplicate', () => {
  const history = ['The Bear', 'Chicago Fire', 'Batman'];

  assert.deepEqual(addRecentSearch(history, 'chicago fire'), [
    'chicago fire', 'The Bear', 'Batman',
  ]);
});

test('ignores an empty search', () => {
  assert.deepEqual(addRecentSearch(['Batman'], '   '), ['Batman']);
});

test('shows all recent searches for an empty field and matching searches while typing', () => {
  const history = ['Chicago Fire', 'Chicago Med', 'Batman'];

  assert.deepEqual(filterRecentSearches(history, ''), history);
  assert.deepEqual(filterRecentSearches(history, ' fire '), ['Chicago Fire']);
  assert.deepEqual(filterRecentSearches(history, 'CHICAGO'), ['Chicago Fire', 'Chicago Med']);
});

test('parses only valid unique strings from persisted data and limits them to five', () => {
  const stored = JSON.stringify(['  Chicago Fire ', 42, '', 'BATMAN', 'batman', 'The Bear', 'Lost', 'Dark', 'Extra']);

  assert.deepEqual(parseRecentSearches(stored), [
    'Chicago Fire', 'BATMAN', 'The Bear', 'Lost', 'Dark',
  ]);
  assert.deepEqual(parseRecentSearches('{broken'), []);
  assert.deepEqual(parseRecentSearches(JSON.stringify({ search: 'Batman' })), []);
  assert.deepEqual(parseRecentSearches(null), []);
});
