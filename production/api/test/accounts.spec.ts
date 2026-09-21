import { env } from "cloudflare:workers";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";

const ORIGIN = "https://allowed.example";
const dispatch = worker.fetch as (request: Request, workerEnv: Env) => Promise<Response>;

function request(path: string, init: RequestInit = {}, envOverrides: Record<string, unknown> = {}) {
  const headers = new Headers(init.headers);
  headers.set("Origin", ORIGIN);
  return dispatch(new Request(`https://showtime.test${path}`, { ...init, headers }), {
    ALLOWED_ORIGINS: ORIGIN,
    SHOWTIME_DB: env.SHOWTIME_DB,
    ...envOverrides,
  } as unknown as Env);
}

function json(body: unknown, extraHeaders: Record<string, string> = {}) {
  return { headers: { "Content-Type": "application/json", ...extraHeaders }, body: JSON.stringify(body) };
}

const TABLES = ["sync_state", "password_reset_tokens", "email_verification_tokens", "sessions", "identities", "users"];

// Mirrors migrations/0001_accounts_and_sync.sql plus 0002_sync_revision.sql. Tests run inside the Workers
// sandbox, where filesystem access to the repo does not resolve the same way
// as under plain Node, so the schema is inlined here rather than read from disk.
// Applied via batch() (one statement per prepare) since D1's exec() requires
// one statement per line and rejects multi-line CREATE TABLE statements.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    email_verified INTEGER NOT NULL DEFAULT 0,
    password_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS identities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('password', 'google')),
    provider_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (provider, provider_user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    device_label TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    used_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    used_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sync_state (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    collection TEXT NOT NULL CHECK (collection IN (
      'watchlist', 'movie-progress', 'tv-progress', 'viewing-activity', 'settings'
    )),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, collection)
  )`,
];

beforeAll(async () => {
  await env.SHOWTIME_DB.batch(STATEMENTS.map((statement) => env.SHOWTIME_DB.prepare(statement)));
});

beforeEach(async () => {
  for (const table of TABLES) await env.SHOWTIME_DB.exec(`DELETE FROM ${table};`);
});

async function signUp(email: string, password = "correct-horse-1") {
  const response = await request("/auth/signup", { method: "POST", ...json({ email, password }) });
  return { response, body: await response.json() as Record<string, any> };
}

describe("Account signup and login", () => {
  it("creates an unverified account and returns a session token", async () => {
    const { response, body } = await signUp("new@example.com");
    expect(response.status).toBe(201);
    expect(body.user).toEqual({ id: expect.any(String), email: "new@example.com", emailVerified: false });
    expect(typeof body.sessionToken).toBe("string");
    expect(typeof body.devVerificationToken).toBe("string");
  });

  it("rejects a weak password", async () => {
    const response = await request("/auth/signup", { method: "POST", ...json({ email: "weak@example.com", password: "short" }) });
    expect(response.status).toBe(400);
  });

  it("rejects a duplicate email", async () => {
    await signUp("dup@example.com");
    const response = await request("/auth/signup", { method: "POST", ...json({ email: "dup@example.com", password: "correct-horse-1" }) });
    expect(response.status).toBe(409);
  });

  it("logs in with the correct password and rejects the wrong one", async () => {
    await signUp("login@example.com", "correct-horse-1");
    const good = await request("/auth/login", { method: "POST", ...json({ email: "login@example.com", password: "correct-horse-1" }) });
    expect(good.status).toBe(200);
    const goodBody = await good.json() as Record<string, any>;
    expect(typeof goodBody.sessionToken).toBe("string");

    const bad = await request("/auth/login", { method: "POST", ...json({ email: "login@example.com", password: "wrong-password-1" }) });
    expect(bad.status).toBe(401);
  });

  it("resolves the current session and rejects an invalid token", async () => {
    const { body } = await signUp("session@example.com");
    const ok = await request("/auth/session", { headers: { Authorization: `Bearer ${body.sessionToken}` } });
    expect(ok.status).toBe(200);
    expect((await ok.json() as Record<string, any>).user.email).toBe("session@example.com");

    const bad = await request("/auth/session", { headers: { Authorization: "Bearer not-a-real-token" } });
    expect(bad.status).toBe(401);
  });

  it("logs out and invalidates the session token", async () => {
    const { body } = await signUp("logout@example.com");
    const auth = { Authorization: `Bearer ${body.sessionToken}` };
    expect((await request("/auth/logout", { method: "POST", headers: auth })).status).toBe(204);
    expect((await request("/auth/session", { headers: auth })).status).toBe(401);
  });

  it("verifies email with the token returned at signup", async () => {
    const { body } = await signUp("verify@example.com");
    const verify = await request("/auth/verify-email", { method: "POST", ...json({ token: body.devVerificationToken }) });
    expect(verify.status).toBe(200);

    const session = await request("/auth/session", { headers: { Authorization: `Bearer ${body.sessionToken}` } });
    expect((await session.json() as Record<string, any>).user.emailVerified).toBe(true);
  });

  it("verifies an email link, then redirects without exposing the token", async () => {
    const { body } = await signUp("verify-link@example.com");
    const response = await request(`/auth/verify-email?token=${body.devVerificationToken}`);

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("https://showtimetracker.show/account?verification=success");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");

    const session = await request("/auth/session", { headers: { Authorization: `Bearer ${body.sessionToken}` } });
    expect((await session.json() as Record<string, any>).user.emailVerified).toBe(true);
  });

  it("rejects an unknown or reused verification token", async () => {
    const response = await request("/auth/verify-email", { method: "POST", ...json({ token: "bogus" }) });
    expect(response.status).toBe(400);
  });

  it("resets a password with a request-reset token and signs out other sessions", async () => {
    const { body } = await signUp("reset@example.com", "original-pass-1");
    const requested = await request("/auth/request-reset", { method: "POST", ...json({ email: "reset@example.com" }) });
    const requestedBody = await requested.json() as Record<string, any>;
    expect(requestedBody.requested).toBe(true);
    expect(typeof requestedBody.devResetToken).toBe("string");

    const reset = await request("/auth/reset-password", {
      method: "POST",
      ...json({ token: requestedBody.devResetToken, password: "brand-new-pass-1" }),
    });
    expect(reset.status).toBe(200);

    // The pre-reset session must no longer work.
    const oldSession = await request("/auth/session", { headers: { Authorization: `Bearer ${body.sessionToken}` } });
    expect(oldSession.status).toBe(401);

    const login = await request("/auth/login", { method: "POST", ...json({ email: "reset@example.com", password: "brand-new-pass-1" }) });
    expect(login.status).toBe(200);
  });

  it("does not reveal whether an email has an account when requesting a reset", async () => {
    const response = await request("/auth/request-reset", { method: "POST", ...json({ email: "nobody@example.com" }) });
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, any>;
    expect(body.devResetToken).toBeUndefined();
  });
});

describe("Sync push and pull", () => {
  async function verifiedSession(email: string) {
    const { body } = await signUp(email);
    await request("/auth/verify-email", { method: "POST", ...json({ token: body.devVerificationToken }) });
    return body.sessionToken as string;
  }

  it("requires a verified email before syncing", async () => {
    const { body } = await signUp("unverified@example.com");
    const response = await request("/sync/pull", { headers: { Authorization: `Bearer ${body.sessionToken}` } });
    expect(response.status).toBe(403);
  });

  it("pushes a collection then pulls it back", async () => {
    const token = await verifiedSession("sync@example.com");
    const auth = { Authorization: `Bearer ${token}` };
    const push = await request("/sync/push", {
      method: "POST",
      ...json({ collection: "watchlist", data: [{ id: 1, mediaType: "Movie" }], expectedRevision: null }, auth),
    });
    expect(push.status).toBe(200);

    const pull = await request("/sync/pull", { headers: auth });
    const pullBody = await pull.json() as Record<string, any>;
    expect(pullBody.collections.watchlist.data).toEqual([{ id: 1, mediaType: "Movie" }]);
    expect(pullBody.collections.watchlist.revision).toBe(1);
  });

  it("rejects a stale device push and preserves the newer value", async () => {
    const token = await verifiedSession("conflict@example.com");
    const auth = { Authorization: `Bearer ${token}` };
    const first = await request("/sync/push", { method: "POST", ...json({ collection: "settings", data: { showTrending: true }, expectedRevision: null }, auth) });
    expect(first.status).toBe(200);
    expect((await first.json() as Record<string, any>).revision).toBe(1);
    const second = await request("/sync/push", { method: "POST", ...json({ collection: "settings", data: { showTrending: false }, expectedRevision: 1 }, auth) });
    expect(second.status).toBe(200);
    expect((await second.json() as Record<string, any>).revision).toBe(2);
    const stale = await request("/sync/push", { method: "POST", ...json({ collection: "settings", data: { showTrending: true }, expectedRevision: 1 }, auth) });
    expect(stale.status).toBe(409);

    const pull = await request("/sync/pull", { headers: auth });
    const pullBody = await pull.json() as Record<string, any>;
    expect(pullBody.collections.settings.data).toEqual({ showTrending: false });
    expect(pullBody.collections.settings.revision).toBe(2);
  });

  it("rejects pushes without a revision so older clients cannot bypass conflict checks", async () => {
    const token = await verifiedSession("legacy-push@example.com");
    const auth = { Authorization: `Bearer ${token}` };
    const push = await request("/sync/push", { method: "POST", ...json({ collection: "settings", data: { showTrending: true } }, auth) });
    expect(push.status).toBe(428);
  });

  it("keeps one account's synced collections private from another account", async () => {
    const firstToken = await verifiedSession("first-private@example.com");
    const secondToken = await verifiedSession("second-private@example.com");
    const firstAuth = { Authorization: `Bearer ${firstToken}` };
    const secondAuth = { Authorization: `Bearer ${secondToken}` };
    const firstPush = await request("/sync/push", { method: "POST", ...json({
      collection: "settings", data: { showTrending: false }, expectedRevision: null,
    }, firstAuth) });
    expect(firstPush.status).toBe(200);
    const secondPull = await request("/sync/pull", { headers: secondAuth });
    expect((await secondPull.json() as Record<string, any>).collections.settings).toBeUndefined();
    const secondPush = await request("/sync/push", { method: "POST", ...json({
      collection: "settings", data: { showTrending: true }, expectedRevision: null,
    }, secondAuth) });
    expect(secondPush.status).toBe(200);
    const firstPull = await request("/sync/pull", { headers: firstAuth });
    expect((await firstPull.json() as Record<string, any>).collections.settings.data).toEqual({ showTrending: false });
  });

  it("rejects an unknown collection and oversized data", async () => {
    const token = await verifiedSession("invalid@example.com");
    const auth = { Authorization: `Bearer ${token}` };
    const unknown = await request("/sync/push", { method: "POST", ...json({ collection: "bogus", data: {} }, auth) });
    expect(unknown.status).toBe(400);

    const oversized = await request("/sync/push", {
      method: "POST",
      ...json({ collection: "watchlist", data: "x".repeat(250_000), expectedRevision: null }, auth),
    });
    expect(oversized.status).toBe(413);
  }, 15_000);
});

describe("Email delivery (when RESEND_API_KEY/EMAIL_FROM are configured)", () => {
  const EMAIL_ENV = { RESEND_API_KEY: "re_test_key", EMAIL_FROM: "Showtime <noreply@showtimetracker.show>" };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emails the verification token instead of returning it, on signup", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));

    const response = await request("/auth/signup", { method: "POST", ...json({ email: "emailed@example.com", password: "correct-horse-1" }) }, EMAIL_ENV);
    const body = await response.json() as Record<string, any>;

    expect(response.status).toBe(201);
    expect(body.devVerificationToken).toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST" }));
    const sentBody = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(sentBody.to).toBe("emailed@example.com");
  });

  it("provides the one-click link to the configured Resend template", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const templateEnv = {
      ...EMAIL_ENV,
      RESEND_VERIFICATION_TEMPLATE_ID: "92d2a801-c7fb-4030-bba0-5e70c1d697ac",
    };

    const response = await request(
      "/auth/signup",
      { method: "POST", ...json({ email: "template@example.com", password: "correct-horse-1" }) },
      templateEnv,
    );
    const body = await response.json() as Record<string, any>;
    const sentBody = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);

    expect(response.status).toBe(201);
    expect(body.devVerificationToken).toBeUndefined();
    expect(sentBody.template).toEqual({
      id: "92d2a801-c7fb-4030-bba0-5e70c1d697ac",
      variables: {
        verification_url: expect.stringMatching(/^https:\/\/showtime\.test\/auth\/verify-email\?token=/),
      },
    });
  });

  it("still creates the account and returns the dev token when the email provider fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("provider down", { status: 500 }));

    const response = await request("/auth/signup", { method: "POST", ...json({ email: "provider-down@example.com", password: "correct-horse-1" }) }, EMAIL_ENV);
    const body = await response.json() as Record<string, any>;

    expect(response.status).toBe(201);
    expect(typeof body.devVerificationToken).toBe("string");
  });

  it("emails the reset token instead of returning it, on password reset request", async () => {
    await request("/auth/signup", { method: "POST", ...json({ email: "reset-emailed@example.com", password: "correct-horse-1" }) });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));

    const response = await request("/auth/request-reset", { method: "POST", ...json({ email: "reset-emailed@example.com" }) }, EMAIL_ENV);
    const body = await response.json() as Record<string, any>;

    expect(response.status).toBe(200);
    expect(body.requested).toBe(true);
    expect(body.devResetToken).toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
