const CACHE_ORIGIN = "https://showtime-api.internal";

export type CacheRoute = {
  kind: string;
  cacheKey: string;
};

export type ApiResult = {
  status: number;
  body: unknown;
};

export type CacheOutcome = "hit" | "miss" | "bypass";

function ttlFor(route: CacheRoute): number {
  if (route.kind === "search") return 0;
  return route.kind === "discovery" ? 1800 : 600;
}

function hasTemporaryScheduleGap(route: CacheRoute, result: ApiResult): boolean {
  if (route.kind !== "tv-schedule") return false;
  const body = result.body as { schedule?: { seasonCoverage?: { status?: string }[] } } | null;
  return body?.schedule?.seasonCoverage?.some((season) => season.status === "unavailable") === true;
}

export async function withApiCache(
  route: CacheRoute,
  cache: Cache,
  load: () => Promise<ApiResult>,
  ctx: Pick<ExecutionContext, "waitUntil">,
): Promise<{ result: ApiResult; outcome: CacheOutcome }> {
  const ttl = ttlFor(route);
  if (!ttl) return { result: await load(), outcome: "bypass" };

  const key = new Request(new URL(route.cacheKey, CACHE_ORIGIN), { method: "GET" });
  const hit = await cache.match(key);
  if (hit) {
    return {
      result: { status: hit.status, body: await hit.json() },
      outcome: "hit",
    };
  }

  const result = await load();
  if (result.status === 200 && !hasTemporaryScheduleGap(route, result)) {
    const stored = new Response(JSON.stringify(result.body), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": `max-age=${ttl}`,
      },
    });
    ctx.waitUntil(cache.put(key, stored));
  }
  return { result, outcome: "miss" };
}
