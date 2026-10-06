var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../shared/notification-gateway.mjs
async function notificationGateway(request, service) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/notifications")) return null;
  const config = url.pathname === "/api/notifications/config", device = url.pathname === "/api/notifications/device";
  if (!config && !device || url.search) return Response.json({ error: "Not found." }, { status: 404 });
  const methods = config ? ["GET"] : ["PUT", "DELETE"];
  if (!methods.includes(request.method)) return Response.json({ error: "Method not allowed." }, { status: 405, headers: { Allow: methods.join(", ") } });
  if (!service) return Response.json({ error: "Notifications are unavailable." }, { status: 503 });
  const headers = new Headers({ Accept: "application/json" });
  for (const name of ["Authorization", "X-Device-Id", "Content-Type", "CF-Connecting-IP"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const body = request.method === "PUT" ? request.body : void 0;
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

// src/worker.ts
var LEGACY_HOSTNAME = "showtime-web.showtime-workers.workers.dev";
var CANONICAL_HOSTNAME = "showtimetracker.show";
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === LEGACY_HOSTNAME) {
      url.protocol = "https:";
      url.hostname = CANONICAL_HOSTNAME;
      url.port = "";
      return Promise.resolve(Response.redirect(url.toString(), 301));
    }
    const notificationResponse = await notificationGateway(request, env.NOTIFICATIONS);
    if (notificationResponse) return notificationResponse;
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://image.tmdb.org; font-src 'self' data:; connect-src 'self' https://api.showtimetracker.show; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
