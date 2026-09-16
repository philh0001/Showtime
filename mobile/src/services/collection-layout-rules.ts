export function getWatchlistColumns(width: number): 1 | 2 | 3 | 4 {
  if (width >= 1200) return 4;
  if (width >= 900) return 3;
  if (width >= 600) return 2;
  return 1;
}

export function getProfileColumns(width: number): 1 | 2 {
  return width >= 600 ? 2 : 1;
}

export function getSearchFormDirection(width: number): 'column' | 'row' {
  return width >= 600 ? 'row' : 'column';
}
