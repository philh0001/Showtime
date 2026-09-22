export function corsHeaders(origin: string | null, allowed: ReadonlySet<string>): Headers {
  const headers = new Headers({ Vary: "Origin" });
  if (origin && allowed.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}

export function withSecurityHeaders(
  headers: HeadersInit,
  requestId: string,
  status: number,
): Headers {
  const result = new Headers(headers);
  result.set("X-Content-Type-Options", "nosniff");
  result.set("Referrer-Policy", "no-referrer");
  result.set("X-Request-ID", requestId);
  if (status >= 400) result.set("Cache-Control", "no-store");
  return result;
}

export function jsonResponse(
  status: number,
  body: unknown,
  requestId: string,
  headers: HeadersInit = {},
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  const securedHeaders = withSecurityHeaders(responseHeaders, requestId, status);
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: securedHeaders,
  });
}
