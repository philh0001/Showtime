export type CastMember = { id: number; name: string; character: string | null; profileUrl: string | null };
export type CrewMember = { id: number; name: string; job: string };
type TrailerUrl = `https://www.youtube.com/watch?v=${string}`;
export type DetailExtras = { cast: CastMember[]; crew: CrewMember[]; trailer: { name: string; url: TrailerUrl } | null };

function person(value: unknown): value is { id: number; name: string; [key: string]: unknown } {
  return Boolean(value && typeof value === 'object' && Number.isSafeInteger((value as CastMember).id)
    && (value as CastMember).id > 0 && typeof (value as CastMember).name === 'string' && (value as CastMember).name.trim());
}

export function normalizeDetailExtras(data: Record<string, unknown>): DetailExtras {
  const cast = (Array.isArray(data.cast) ? data.cast : []).filter(person).slice(0, 12).map((item) => ({
    id: item.id, name: item.name,
    character: typeof item.character === 'string' ? item.character : null,
    profileUrl: typeof item.profileUrl === 'string' && /^https:\/\/image\.tmdb\.org\/t\/p\/w185\/[\w.-]+$/.test(item.profileUrl) ? item.profileUrl : null,
  }));
  const crew = (Array.isArray(data.crew) ? data.crew : []).filter(person)
    .filter((item) => typeof item.job === 'string' && item.job.trim()).slice(0, 8)
    .map((item) => ({ id: item.id, name: item.name, job: String(item.job) }));
  const video = data.trailer && typeof data.trailer === 'object' ? data.trailer as Record<string, unknown> : null;
  const trailer = video && typeof video.name === 'string' && typeof video.url === 'string'
    && /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/.test(video.url)
    ? { name: video.name, url: video.url as TrailerUrl } : null;
  return { cast, crew, trailer };
}
