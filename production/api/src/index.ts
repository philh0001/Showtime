import { parseApiRequest } from "../../../shared/tmdb-api/request.mjs";
import { handleDetails } from "../../../shared/tmdb-api/details.mjs";
import { handleDiscovery } from "../../../shared/tmdb-api/discovery.mjs";
import { handleSearch } from "../../../shared/tmdb-api/search.mjs";
import { fetchTmdbJson } from "../../../shared/tmdb-api/tmdb.mjs";
import { accountPreflightHeaders, isAllowedOrigin, parseAllowedOrigins, preflightHeaders } from "./cors";
import { logEvent, type SafeRoute } from "./logging";
import { corsHeaders, jsonResponse } from "./response";
import { enforceRateLimits } from "./rate-limit";
import { withApiCache } from "./cache";
import { handleAccountRequest, isAccountPath } from "./account-routes";

type RateLimitBinding = { limit(options: { key: string }): Promise<{ success: boolean }> };

type WorkerEnv = Env & {
  ALLOWED_ORIGINS?: string;
  TMDB_READ_ACCESS_TOKEN?: string;
  SEARCH_LIMITER?: RateLimitBinding;
  DISCOVERY_LIMITER?: RateLimitBinding;
  DETAILS_LIMITER?: RateLimitBinding;
  WORK_LIMITER?: RateLimitBinding;
  AUTH_LIMITER?: RateLimitBinding;
  SYNC_LIMITER?: RateLimitBinding;
  SHOWTIME_DB?: D1Database;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  APP_NAME?: string;
  RESEND_VERIFICATION_TEMPLATE_ID?: string;
  APP_URL?: string;
};

// Email sending is optional until a domain is verified with Resend: only
// build a config (and thus send real emails) once both a key and a verified
// "from" address are set. Until then, handlers fall back to dev tokens.
function emailConfig(env: WorkerEnv) {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return null;
  return {
    apiKey,
    from,
    appName: env.APP_NAME?.trim() || "Showtime",
    verificationTemplateId: env.RESEND_VERIFICATION_TEMPLATE_ID?.trim() || undefined,
  };
}

function verificationRedirect(appUrl: string | undefined, verified: boolean): Response {
  const destination = new URL("/account", appUrl?.trim() || "https://showtimetracker.show");
  destination.searchParams.set("verification", verified ? "success" : "invalid");
  return new Response(null, {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
      Location: destination.toString(),
      "Referrer-Policy": "no-referrer",
    },
  });
}

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
  async fetch(request: Request, env: WorkerEnv, executionContext?: ExecutionContext): Promise<Response> {
    const requestId = crypto.randomUUID();
    const startedAt = performance.now();
    const origin = request.headers.get("Origin");
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
    let route: SafeRoute = "unmatched";
    let status = 500;
    let cacheOutcome: "hit" | "miss" | "bypass" = "bypass";

    const finish = (response: Response): Response => {
      status = response.status;
      logEvent({
        requestId,
        route,
        status,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
        cache: cacheOutcome,
      });
      return response;
    };

    const securityHeaders = corsHeaders(origin, allowedOrigins);
    if (!isAllowedOrigin(origin, allowedOrigins)) {
      return finish(jsonResponse(403, { error: "Origin is not allowed." }, requestId, securityHeaders));
    }

    let pathname = "";
    try {
      pathname = new URL(request.url).pathname;
    } catch {
      // Fall through: parseApiRequest below returns a proper 400 for an invalid URL.
    }
    const clientKey = request.headers.get("CF-Connecting-IP")?.trim() || "anonymous";

    if (isAccountPath(pathname)) {
      route = pathname.startsWith("/auth/") ? "auth" : "sync";
      if (request.method === "OPTIONS") {
        const headers = new Headers(securityHeaders);
        for (const [key, value] of accountPreflightHeaders()) headers.set(key, value);
        return finish(jsonResponse(204, null, requestId, headers));
      }
      const limiter = pathname.startsWith("/auth/") ? env.AUTH_LIMITER : env.SYNC_LIMITER;
      if (limiter && !(await limiter.limit({ key: clientKey })).success) {
        return finish(jsonResponse(429, { error: "Please wait a moment and try again." }, requestId, securityHeaders));
      }
      if (!env.SHOWTIME_DB) {
        return finish(jsonResponse(503, { error: "Accounts are not configured yet." }, requestId, securityHeaders));
      }
      if (pathname === "/auth/verify-email" && request.method === "GET") {
        const result = await handleAccountRequest(
          new Request(request.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: new URL(request.url).searchParams.get("token") }),
          }),
          env.SHOWTIME_DB,
          emailConfig(env),
        );
        return finish(verificationRedirect(env.APP_URL, result.status === 200));
      }
      const result = await handleAccountRequest(request, env.SHOWTIME_DB, emailConfig(env));
      return finish(jsonResponse(result.status, result.body, requestId, securityHeaders));
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
    if (!(await enforceRateLimits(parsed.route, env, clientKey))) {
      return finish(jsonResponse(429, { error: "Please wait a moment and try again." }, requestId, securityHeaders));
    }

    const deps = {
      token: env.TMDB_READ_ACCESS_TOKEN,
      fetchTmdbJson,
      optionalTimeoutMs: 3000,
    };
    const load = () => {
      if (parsed.route.kind === "search") return handleSearch(parsed.route, deps);
      if (parsed.route.kind === "discovery") return handleDiscovery(parsed.route, deps);
      return handleDetails(parsed.route, deps);
    };
    const cached = executionContext
      ? await withApiCache(parsed.route, caches.default, load, executionContext)
      : { result: await load(), outcome: "bypass" as const };
    cacheOutcome = cached.outcome;
    const { result } = cached;
    return finish(jsonResponse(result.status, result.body, requestId, securityHeaders));
  },
} satisfies ExportedHandler<WorkerEnv>;
