const ALWAYS_VISIBLE_EPISODE_LIMIT = 6;

export function getInitialEpisodeExpansion(episodeCount: number) {
  return episodeCount > 0 && episodeCount <= ALWAYS_VISIBLE_EPISODE_LIMIT;
}

export function canToggleEpisodeExpansion(episodeCount: number) {
  return episodeCount > ALWAYS_VISIBLE_EPISODE_LIMIT;
}

export function getDetailsLayout(width: number): 'stacked' | 'split' {
  return width >= 900 ? 'split' : 'stacked';
}
