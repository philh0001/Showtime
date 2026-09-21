export type ApiResponse<T> = { ok: boolean; status: number; body: T };
export type SyncCollection = 'watchlist' | 'movie-progress' | 'tv-progress' | 'viewing-activity' | 'settings';
export type SyncPullBody = {
  collections: Record<string, { data: unknown; updatedAt: string; revision: number }>;
  error?: string;
};
