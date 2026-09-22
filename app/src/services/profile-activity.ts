import type { ViewingActivity } from './viewing-activity-rules.ts';

export function getProfileActivityPreview(records: ViewingActivity[]): ViewingActivity[] {
  return [...records]
    .sort((a, b) => b.happenedAt.localeCompare(a.happenedAt) || b.sequence - a.sequence)
    .slice(0, 3);
}

export function formatActivityAge(happenedAt: string, now = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(happenedAt).getTime()) / 60000));
  if (minutes < 60) return minutes < 5 ? 'Just now' : `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  return new Date(happenedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
