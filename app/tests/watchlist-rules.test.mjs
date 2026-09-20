import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addWatchlistItem,
  isInWatchlist,
  parseWatchlist,
  removeWatchlistItem,
} from '../src/services/watchlist-rules.ts';

const movie = {
  id: 123,
  mediaType: 'Movie',
  title: 'Example Movie',
  year: '2024',
  posterUrl: 'https://image.tmdb.org/movie.jpg',
};

const tvShow = {
  id: 123,
  mediaType: 'TV',
  title: 'Example Show',
  year: '2023',
  posterUrl: null,
};

test('movie and TV titles with the same TMDB ID remain separate items', () => {
  const watchlist = addWatchlistItem(addWatchlistItem([], movie), tvShow);

  assert.deepEqual(watchlist, [tvShow, movie]);
  assert.equal(isInWatchlist(watchlist, 123, 'Movie'), true);
  assert.equal(isInWatchlist(watchlist, 123, 'TV'), true);
});

test('adding an existing title updates it and moves it to the front', () => {
  const updatedMovie = { ...movie, title: 'Updated Movie', year: '2025' };
  const watchlist = addWatchlistItem([movie, tvShow], updatedMovie);

  assert.deepEqual(watchlist, [updatedMovie, tvShow]);
});

test('removing a title leaves a different media type with the same ID intact', () => {
  const watchlist = removeWatchlistItem([movie, tvShow], 123, 'Movie');

  assert.deepEqual(watchlist, [tvShow]);
});

test('persisted data keeps only complete, valid and unique watchlist items', () => {
  const stored = JSON.stringify([
    movie,
    { ...movie, title: 'Duplicate' },
    tvShow,
    { ...movie, id: 0 },
    { ...movie, mediaType: 'Person' },
    { ...movie, title: '' },
    { ...movie, year: 2024 },
  ]);

  assert.deepEqual(parseWatchlist(stored), [movie, tvShow]);
  assert.deepEqual(parseWatchlist('{broken'), []);
  assert.deepEqual(parseWatchlist(null), []);
});
