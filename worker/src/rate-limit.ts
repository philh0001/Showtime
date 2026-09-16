export type RateLimitRoute = {
  kind: string;
  cost: number;
};

type RateLimitBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

type RateLimitEnv = {
  SEARCH_LIMITER?: RateLimitBinding;
  DISCOVERY_LIMITER?: RateLimitBinding;
  DETAILS_LIMITER?: RateLimitBinding;
  WORK_LIMITER?: RateLimitBinding;
};

export async function enforceRateLimits(
  route: RateLimitRoute,
  env: RateLimitEnv,
  clientKey: string,
): Promise<boolean> {
  const category = route.kind === "search"
    ? env.SEARCH_LIMITER
    : route.kind === "discovery"
      ? env.DISCOVERY_LIMITER
      : env.DETAILS_LIMITER;

  // These location-local, eventually consistent limits are best-effort abuse
  // controls, not user identity or exact quota accounting.
  if (!category || !env.WORK_LIMITER) return true;
  if (!(await category.limit({ key: clientKey })).success) return false;

  for (let unit = 0; unit < route.cost; unit += 1) {
    if (!(await env.WORK_LIMITER.limit({ key: clientKey })).success) return false;
  }
  return true;
}
