// Routes /auth/* and /sync/* to the handlers in api/auth.ts and api/sync.ts.
// Kept separate from the TMDB request parser (api/request.mjs) because these
// routes are POST-heavy, require a bearer session and never use the TMDB
// response cache.
import {
  handleLogin,
  handleLogout,
  handleRequestPasswordReset,
  handleResetPassword,
  handleSessionInfo,
  handleSignup,
  handleVerifyEmail,
  resolveSession,
  type ApiResult,
  type Deps,
} from "./api/auth";
import { handleSyncPull, handleSyncPush } from "./api/sync";
import type { EmailConfig } from "./email";

const MAX_BODY_BYTES = 20_000;

export function isAccountPath(pathname: string): boolean {
  return pathname.startsWith("/auth/") || pathname.startsWith("/sync/");
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 && token.length <= 200 ? token : null;
}

async function readJsonBody(request: Request): Promise<{ ok: true; value: unknown } | { ok: false; status: number; error: string }> {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: "Request body is too large." };
  }
  if (!text) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON body." };
  }
}

export async function handleAccountRequest(request: Request, db: D1Database, email: EmailConfig | null): Promise<ApiResult> {
  const url = new URL(request.url);
  const { pathname } = url;
  const { method } = request;
  const deps: Deps = {
    db,
    now: Date.now,
    email,
    verificationUrl: (token) => {
      const verificationUrl = new URL("/auth/verify-email", url.origin);
      verificationUrl.searchParams.set("token", token);
      return verificationUrl.toString();
    },
  };

  if (pathname === "/auth/signup" && method === "POST") {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return { status: parsed.status, body: { error: parsed.error } };
    return handleSignup(parsed.value, deps);
  }
  if (pathname === "/auth/login" && method === "POST") {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return { status: parsed.status, body: { error: parsed.error } };
    return handleLogin(parsed.value, deps);
  }
  if (pathname === "/auth/logout" && method === "POST") return handleLogout(bearerToken(request), deps);
  if (pathname === "/auth/session" && method === "GET") return handleSessionInfo(bearerToken(request), deps);
  if (pathname === "/auth/verify-email" && method === "POST") {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return { status: parsed.status, body: { error: parsed.error } };
    return handleVerifyEmail(parsed.value, deps);
  }
  if (pathname === "/auth/request-reset" && method === "POST") {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return { status: parsed.status, body: { error: parsed.error } };
    return handleRequestPasswordReset(parsed.value, deps);
  }
  if (pathname === "/auth/reset-password" && method === "POST") {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return { status: parsed.status, body: { error: parsed.error } };
    return handleResetPassword(parsed.value, deps);
  }
  if (pathname === "/sync/pull" && method === "GET") {
    const user = await resolveSession(bearerToken(request), deps);
    if (!user) return { status: 401, body: { error: "Sign in again." } };
    return handleSyncPull(user, deps);
  }
  if (pathname === "/sync/push" && method === "POST") {
    const user = await resolveSession(bearerToken(request), deps);
    if (!user) return { status: 401, body: { error: "Sign in again." } };
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return { status: parsed.status, body: { error: parsed.error } };
    return handleSyncPush(user, parsed.value, deps);
  }

  return { status: 404, body: { error: "Not found." } };
}
