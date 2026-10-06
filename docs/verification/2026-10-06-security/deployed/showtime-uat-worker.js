var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../shared/notification-gateway.mjs
async function notificationGateway(request, service) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/notifications")) return null;
  const config = url.pathname === "/api/notifications/config", device = url.pathname === "/api/notifications/device";
  if (!config && !device || url.search) return Response.json({ error: "Not found." }, { status: 404 });
  const methods = config ? ["GET"] : ["GET", "PATCH", "PUT", "DELETE"];
  if (!methods.includes(request.method)) return Response.json({ error: "Method not allowed." }, { status: 405, headers: { Allow: methods.join(", ") } });
  if (!service) return Response.json({ error: "Notifications are unavailable." }, { status: 503 });
  const headers = new Headers({ Accept: "application/json" });
  for (const name of ["Authorization", "X-Device-Id", "Content-Type", "CF-Connecting-IP"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const body = ["PUT", "PATCH"].includes(request.method) ? request.body : void 0;
    const init = { method: request.method, headers, body, redirect: "manual", signal: AbortSignal.timeout(15e3) };
    if (body) init.duplex = "half";
    const response = await service.fetch(new Request(`https://notifications.internal${url.pathname.slice(4)}`, init));
    if (response.status >= 300 && response.status < 400) throw Error("Unexpected notification redirect");
    return new Response(response.body, { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Notifications are temporarily unavailable." }, { status: 502 });
  }
}
__name(notificationGateway, "notificationGateway");

// ../../shared/tmdb-api/request.mjs
var MAX_URL_BYTES = 2048;
var MAX_SEARCH_LENGTH = 100;
var POSITIVE_INTEGER = /^[1-9]\d*$/;
var failure = /* @__PURE__ */ __name((status, error) => ({ ok: false, status, body: { error } }), "failure");
function success(route, method) {
  const parsedRoute = method === "OPTIONS" ? { kind: "options", cacheKey: route.cacheKey, cost: 0 } : route;
  return { ok: true, route: Object.freeze(parsedRoute) };
}
__name(success, "success");
function positiveSafeInteger(value) {
  if (!POSITIVE_INTEGER.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
__name(positiveSafeInteger, "positiveSafeInteger");
function hasNoncanonicalDotSegment(url) {
  const match = /^[a-z][a-z\d+.-]*:\/\/[^/?#]*([^?#]*)/i.exec(url);
  if (!match) return false;
  if (match[1].includes("\\")) return true;
  return match[1].split("/").some((segment) => {
    const dots = segment.replaceAll(/%2e/gi, ".");
    return dots === "." || dots === "..";
  });
}
__name(hasNoncanonicalDotSegment, "hasNoncanonicalDotSegment");
function noQueryParameters(incoming) {
  return [...incoming.searchParams].length === 0;
}
__name(noQueryParameters, "noQueryParameters");
function searchRoute(incoming) {
  const queries = incoming.searchParams.getAll("query");
  if ([...incoming.searchParams.keys()].some((key) => !["query", "type", "page"].includes(key)) || queries.length !== 1) {
    return failure(400, "Enter a title of 1\u2013100 characters.");
  }
  const query = queries[0].trim();
  if (query.length < 1 || query.length > MAX_SEARCH_LENGTH) {
    return failure(400, "Enter a title of 1\u2013100 characters.");
  }
  const types = incoming.searchParams.getAll("type");
  const pages = incoming.searchParams.getAll("page");
  const type = types[0] ?? "all";
  const page = pages.length ? positiveSafeInteger(pages[0]) : 1;
  if (types.length > 1 || pages.length > 1 || !["all", "tv", "movie"].includes(type) || page === null || page > 500) return failure(400, "Choose a valid search type and page.");
  const extended = types.length > 0 || pages.length > 0;
  return {
    ...extended ? { type, page } : {},
    kind: "search",
    query,
    cacheKey: `/search?${new URLSearchParams(extended ? { query, type, page: String(page) } : { query })}`,
    cost: 1
  };
}
__name(searchRoute, "searchRoute");
function detailsRoute(pathname) {
  const season = /^\/details\/tv\/([^/]*)\/season\/([^/]*)$/.exec(pathname);
  if (season) {
    const id2 = positiveSafeInteger(season[1]);
    const seasonNumber = positiveSafeInteger(season[2]);
    if (id2 === null || seasonNumber === null) {
      return failure(400, "Choose a valid TV season.");
    }
    return {
      kind: "season-details",
      id: id2,
      seasonNumber,
      cacheKey: `/details/tv/${id2}/season/${seasonNumber}`,
      cost: 1
    };
  }
  const details = /^\/details\/(movie|tv|person)\/([^/]*)$/.exec(pathname);
  if (!details) return null;
  const id = positiveSafeInteger(details[2]);
  if (id === null) return failure(400, "Choose a valid title or person.");
  const kind = `${details[1]}-details`;
  const cost = details[1] === "movie" ? 4 : details[1] === "tv" ? 5 : 1;
  return {
    kind,
    id,
    cacheKey: `/details/${details[1]}/${id}`,
    cost
  };
}
__name(detailsRoute, "detailsRoute");
function scheduleRoute(pathname) {
  const match = /^\/schedule\/tv\/([^/]*)$/.exec(pathname);
  if (!match) return null;
  const id = positiveSafeInteger(match[1]);
  if (id === null) return failure(400, "Choose a valid TV show.");
  return { kind: "tv-schedule", id, cacheKey: `/schedule/tv/${id}`, cost: 13 };
}
__name(scheduleRoute, "scheduleRoute");
function parseApiRequest({ method, url }) {
  if (new TextEncoder().encode(url).byteLength > MAX_URL_BYTES) {
    return failure(414, "Request URL is too long.");
  }
  let incoming;
  try {
    incoming = new URL(url);
  } catch {
    return failure(400, "Invalid request URL.");
  }
  if (!["GET", "OPTIONS"].includes(method)) {
    return { ...failure(405, "Use GET."), allow: "GET, OPTIONS" };
  }
  if (url.split(/[?#]/, 1)[0].includes("\\")) return failure(404, "Not found.");
  if (hasNoncanonicalDotSegment(url)) return failure(404, "Not found.");
  let route;
  if (incoming.pathname === "/search") {
    route = searchRoute(incoming);
  } else if (incoming.pathname === "/discovery") {
    route = noQueryParameters(incoming) ? { kind: "discovery", cacheKey: "/discovery", cost: 2 } : failure(400, "Query parameters are not allowed.");
  } else {
    const summary = /^\/summary\/tv\/([^/]*)$/.exec(incoming.pathname);
    route = summary ? positiveSafeInteger(summary[1]) === null ? failure(400, "Choose a valid TV show.") : { kind: "tv-summary", id: Number(summary[1]), cacheKey: `/summary/tv/${summary[1]}`, cost: 1 } : scheduleRoute(incoming.pathname) ?? detailsRoute(incoming.pathname);
    if (route && route.ok !== false && !noQueryParameters(incoming)) {
      route = failure(400, "Query parameters are not allowed.");
    }
  }
  if (!route) return failure(404, "Not found.");
  if (route.ok === false) return route;
  return success(route, method);
}
__name(parseApiRequest, "parseApiRequest");

// src/worker.mjs
var contentKinds = /* @__PURE__ */ new Set(["search", "discovery", "movie-details", "tv-details", "season-details", "person-details", "tv-schedule", "tv-summary"]);
function noindex(response) {
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://image.tmdb.org; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
__name(noindex, "noindex");
function createWorker(upstreamFetch) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.pathname === "/robots.txt") return noindex(new Response("User-agent: *\nDisallow: /\n"));
      const notificationResponse = await notificationGateway(request, env.NOTIFICATIONS);
      if (notificationResponse) return noindex(notificationResponse);
      if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
        if (request.method !== "GET") return noindex(Response.json({ error: "Use GET." }, { status: 405, headers: { Allow: "GET" } }));
        const parsed = parseApiRequest({ method: "GET", url: `https://api.showtimetracker.show${url.pathname.slice(4)}${url.search}` });
        if (!parsed.ok) return noindex(Response.json(parsed.body, { status: parsed.status }));
        if (!contentKinds.has(parsed.route.kind)) return noindex(Response.json({ error: "Not found." }, { status: 404 }));
        try {
          const upstreamUrl = `https://api.showtimetracker.show${parsed.route.cacheKey}`;
          const init = { method: "GET", headers: { Accept: "application/json" }, redirect: "manual", signal: AbortSignal.timeout(2e4) };
          if (!env.CONTENT_API && !upstreamFetch) throw new Error("Content service binding is unavailable.");
          const response = env.CONTENT_API ? await env.CONTENT_API.fetch(new Request(upstreamUrl, init)) : await upstreamFetch(upstreamUrl, init);
          if (response.status >= 300 && response.status < 400) throw new Error("Unexpected upstream redirect.");
          console.log(JSON.stringify({ route: parsed.route.kind, status: response.status }));
          const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
          return noindex(new Response(response.body, { status: response.status, headers }));
        } catch {
          console.log(JSON.stringify({ route: parsed.route.kind, status: 502 }));
          return noindex(Response.json({ error: "Content is temporarily unavailable. Please try again." }, { status: 502 }));
        }
      }
      return noindex(await env.ASSETS.fetch(request));
    }
  };
}
__name(createWorker, "createWorker");
var worker_default = createWorker();
export {
  createWorker,
  worker_default as default
};
//# sourceMappingURL=worker.js.map
