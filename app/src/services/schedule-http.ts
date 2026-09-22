import { parseScheduleResponse } from './schedule-response-rules.ts';

export class ScheduleFetchError extends Error {
  status: number;
  constructor(status: number) { super('Could not update your schedule.'); this.status = status; }
}

export async function fetchScheduleAt(baseUrl: string, id: number, fetchImpl: typeof fetch = fetch,
  timeoutMs = 15_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let stage: 'request' | 'body' = 'request';
  try {
    const response = await fetchImpl(`${baseUrl}/schedule/tv/${id}`, { signal: controller.signal });
    stage = 'body';
    if (!response.ok) throw new ScheduleFetchError(response.status);
    const body: unknown = await response.json();
    const parsed = parseScheduleResponse(body, id);
    if (!parsed) throw new ScheduleFetchError(502);
    return parsed;
  } catch (error) {
    if (error instanceof ScheduleFetchError) throw error;
    if (controller.signal.aborted || stage === 'request') throw new ScheduleFetchError(0);
    throw new ScheduleFetchError(502);
  } finally {
    clearTimeout(timeout);
  }
}
