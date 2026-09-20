export function parseAllowedOrigins(value: string | undefined): ReadonlySet<string> {
  if (typeof value !== "string") return new Set();
  return new Set(value.split(",").map((origin) => origin.trim()).filter(Boolean));
}

export function isAllowedOrigin(origin: string | null, allowed: ReadonlySet<string>): boolean {
  return origin === null || allowed.has(origin);
}

export function preflightHeaders(): Headers {
  return new Headers({
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
  });
}

export function accountPreflightHeaders(): Headers {
  return new Headers({
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "600",
  });
}
