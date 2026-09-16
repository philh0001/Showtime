import assert from 'node:assert/strict';
import test from 'node:test';

import { getProviderSearchUrl } from '../src/services/provider-search-rules.ts';

test('builds links to supported provider websites', () => {
  assert.equal(getProviderSearchUrl('Netflix', 'The Bear & Friends'),
    'https://www.netflix.com/gb/');
  assert.equal(getProviderSearchUrl('Amazon Prime Video', 'Dune: Part Two'),
    'https://www.primevideo.com/');
});

test('does not construct URLs for unknown providers or empty titles', () => {
  assert.equal(getProviderSearchUrl('Untrusted Provider', 'A title'), null);
  assert.equal(getProviderSearchUrl('Netflix', '   '), null);
});
