import { parseApiRequest } from "./api/request.mjs";
import { handleDetails } from "./api/details.mjs";
import { handleDiscovery } from "./api/discovery.mjs";
import { handleSearch } from "./api/search.mjs";
import { fetchTmdbJson } from "./api/tmdb.mjs";
import { isAllowedOrigin, parseAllowedOrigins, preflightHeaders } from "./cors";
import { logEvent, type SafeRoute } from "./logging";
import { corsHeaders, jsonResponse } from "./response";
import { enforceRateLimits } from "./rate-limit";

type WorkerEnv = Env & {
  ALLOWED_ORIGINS?: string;
  TMDB_READ_ACCESS_TOKEN?: string;
  SEARCH_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  DISCOVERY_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  DETAILS_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  WORK_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
};

type ApiRoute = {
  kind: string;
  cacheKey: string;
  cost: number;
  query?: string;
  id?: number;
  seasonNumber?: number;
};

type ParsedApiRequest =
  | { ok: true; route: ApiRoute }
  | { ok: false; status: number; body: { error: string }; allow?: string };

function routeName(kind: string | undefined): SafeRoute {
  if (
    kind === "search"
    || kind === "discovery"
    || kind === "movie-details"
    || kind === "tv-details"
    || kind === "season-details"
    || kind === "person-details"
  ) return kind;
  return "unmatched";
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const requestId = crypto.randomUUID();
    const startedAt = performance.now();
    const origin = request.headers.get("Origin");
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
    let route: SafeRoute = "unmatched";
    let status = 500;

    const finish = (response: Response): Response => {
      status = response.status;
      logEvent({
        requestId,
        route,
        status,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
        cache: "bypass",
      });
      return response;
    };

    const securityHeaders = corsHeaders(origin, allowedOrigins);
    if (!isAllowedOrigin(origin, allowedOrigins)) {
      return finish(jsonResponse(403, { error: "Origin is not allowed." }, requestId, securityHeaders));
    }

    const parsed = parseApiRequest({ method: request.method, url: request.url }) as ParsedApiRequest;
    if (!parsed.ok) {
      const headers = new Headers(securityHeaders);
      if ("allow" in parsed && parsed.allow) headers.set("Allow", parsed.allow);
      return finish(jsonResponse(parsed.status, parsed.body, requestId, headers));
    }

    if (parsed.route.kind === "options") {
      const headers = new Headers(securityHeaders);
      for (const [key, value] of preflightHeaders()) headers.set(key, value);
      return finish(jsonResponse(204, null, requestId, headers));
    }

    route = routeName(parsed.route.kind);
    if (!env.TMDB_READ_ACCESS_TOKEN?.trim()) {
      return finish(jsonResponse(503, { error: "The API is not configured yet." }, requestId, securityHeaders));
    }
    const clientKey = request.headers.get("CF-Connecting-IP")?.trim() || "anonymous";
    if (!(await enforceRateLimits(parsed.route, env, clientKey))) {
      return finish(jsonResponse(429, { error: "Please wait a moment and try again." }, requestId, securityHeaders));
    }

    let result;
    const deps = {
      token: env.TMDB_READ_ACCESS_TOKEN,
      fetchTmdbJson,
      optionalTimeoutMs: 3000,
    };
    if (parsed.route.kind === "search") {
      result = await handleSearch(parsed.route, deps);
    } else if (parsed.route.kind === "discovery") {
      result = await handleDiscovery(parsed.route, deps);
    } else {
      result = await handleDetails(parsed.route, deps);
    }
    return finish(jsonResponse(result.status, result.body, requestId, securityHeaders));
  },
} satisfies ExportedHandler<WorkerEnv>;
