import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";

const TOKEN = "test-only-tmdb-secret";
const ORIGIN = "https://allowed.example";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const dispatch = worker.fetch as (request: Request, env: Env) => Promise<Response>;

function request(path: string, init: RequestInit = {}, token: string | undefined = TOKEN) {
  return dispatch(new Request(`https://showtime.test${path}`, init), {
    TMDB_READ_ACCESS_TOKEN: token,
    ALLOWED_ORIGINS: ` ${ORIGIN},https://second.example `,
  } as unknown as Env);
}

function upstreamBody(url: URL) {
  if (url.pathname === "/3/search/multi") {
    return { results: [{ id: 10, media_type: "movie", title: "Batman", release_date: "1989-06-23", poster_path: null }] };
  }
  if (url.pathname === "/3/trending/movie/week") return { results: [{ id: 10, title: "Batman" }] };
  if (url.pathname === "/3/trending/tv/week") return { results: [{ id: 20, name: "Show" }] };
  if (url.pathname === "/3/movie/10") return { id: 10, title: "Batman" };
  if (url.pathname === "/3/tv/20") return { id: 20, name: "Show", seasons: [] };
  if (url.pathname === "/3/tv/20/season/1") return { id: 30, season_number: 1, name: "Season One", episodes: [] };
  if (url.pathname === "/3/person/40") return { id: 40, name: "Actor" };
  if (/\/(credits|videos|watch\/providers)$/.test(url.pathname)) return { cast: [], crew: [], results: {} };
  throw new Error(`Unexpected outbound endpoint: ${url.pathname}`);
}

describe("Worker security boundary", () => {
  let outbound: ReturnType<typeof vi.spyOn>;
  let logs: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logs = vi.spyOn(console, "log").mockImplementation(() => {});
    outbound = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      return Response.json(upstreamBody(url));
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([
    [ORIGIN, ORIGIN, 200],
    ["https://second.example", "https://second.example", 200],
    ["https://evil.example", null, 403],
    ["https://allowed.example.evil.example", null, 403],
    ["https://allowed.example:444", null, 403],
    ["null", null, 403],
    [null, null, 200],
  ])("enforces exact CORS matching for %s", async (origin, expected, status) => {
    const response = await request("/search?query=Batman", { headers: origin ? { Origin: origin } : {} });
    expect(response.status).toBe(status);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(expected);
    expect(response.headers.get("Vary")).toContain("Origin");
    expect(response.headers.has("Access-Control-Allow-Credentials")).toBe(false);
    expect(outbound).toHaveBeenCalledTimes(status === 403 ? 0 : 1);
  });

  it("denies browser origins when the allowlist is empty", async () => {
    const response = await dispatch(new Request("https://showtime.test/discovery", { headers: { Origin: ORIGIN } }), {
      ALLOWED_ORIGINS: "", TMDB_READ_ACCESS_TOKEN: TOKEN,
    } as unknown as Env);
    expect(response.status).toBe(403);
    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
    expect(outbound).not.toHaveBeenCalled();
  });

  it.each([[ORIGIN, 204], ["https://evil.example", 403], [null, 204]])(
    "handles preflight for %s without the secret or upstream work", async (origin, status) => {
      const response = await request("/search?query=Batman", {
        method: "OPTIONS",
        headers: { ...(origin ? { Origin: origin } : {}), "Access-Control-Request-Method": "GET" },
      }, "");
      expect(response.status).toBe(status);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin === ORIGIN ? ORIGIN : null);
      if (status === 204) {
        expect(await response.text()).toBe("");
        expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
      }
      expect(outbound).not.toHaveBeenCalled();
    },
  );

  it.each(["POST", "PUT", "DELETE", "HEAD", "PATCH"])("rejects %s before upstream work", async (method) => {
    const response = await request("/discovery", { method });
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, OPTIONS");
    expect(outbound).not.toHaveBeenCalled();
  });

  it.each([
    ["/search?query=Batman", {}, 200, 200],
    ["/discovery", { method: "OPTIONS" }, 204, 200],
    ["/search?query=", {}, 400, 200],
    ["/discovery", { headers: { Origin: "https://evil.example" } }, 403, 200],
    ["/private/raw-path", {}, 404, 200],
    ["/discovery", { method: "POST" }, 405, 200],
    [`/search?query=${"a".repeat(2100)}`, {}, 414, 200],
    ["/search?query=Batman", {}, 429, 429],
    ["/search?query=Batman", {}, 502, 500],
  ] as const)("applies security headers to %s (%s)", async (path, init, status, upstreamStatus) => {
    if (upstreamStatus !== 200) outbound.mockResolvedValue(new Response("private upstream body", { status: upstreamStatus }));
    const response = await request(path, init);
    expect(response.status).toBe(status);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Request-ID")).toMatch(UUID);
    expect(response.headers.get("Vary")).toContain("Origin");
    if (status >= 400) expect(response.headers.get("Cache-Control")).toBe("no-store");
    if (status !== 204) expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
  });

  it("ignores caller request IDs and generates unique UUIDs", async () => {
    const responses = await Promise.all(Array.from({ length: 5 }, () => request("/discovery", {
      headers: { "X-Request-ID": "untrusted-id", "CF-Ray": "untrusted-ray" },
    })));
    const ids = responses.map((response) => response.headers.get("X-Request-ID"));
    ids.forEach((id) => expect(id).toMatch(UUID));
    expect(new Set(ids).size).toBe(5);
  });

  it.each(["", "   "])("fails closed for a missing or blank secret (%j)", async (token) => {
    const response = await request("/discovery", { headers: { Origin: ORIGIN } }, token);
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Request-ID")).toMatch(UUID);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(outbound).not.toHaveBeenCalled();
  });

  it("fails closed for an absent secret binding", async () => {
    const response = await dispatch(new Request("https://showtime.test/discovery"), { ALLOWED_ORIGINS: "" } as unknown as Env);
    expect(response.status).toBe(503);
    expect(outbound).not.toHaveBeenCalled();
  });

  it.each([
    ["/search?query=Batman", "search", { results: [{ id: "movie-10", title: "Batman", year: "1989", mediaType: "Movie", posterUrl: null }] }, 1],
    ["/discovery", "discovery", { movies: [{ id: 10, title: "Batman" }], tv: [{ id: 20, title: "Show" }] }, 2],
    ["/details/movie/10", "movie-details", { details: { id: 10, title: "Batman", mediaType: "Movie" } }, 4],
    ["/details/tv/20", "tv-details", { details: { id: 20, title: "Show", mediaType: "TV" } }, 4],
    ["/schedule/tv/20", "tv-schedule", { schedule: { id: 20, title: "Show", coverage: "complete", episodes: [] } }, 1],
    ["/details/tv/20/season/1", "season-details", { season: { seasonNumber: 1, name: "Season One", episodes: [] } }, 1],
    ["/details/person/40", "person-details", { person: { id: 40, name: "Actor" } }, 1],
  ] as const)("dispatches %s through the shared handler and hardened transport", async (path, route, body, calls) => {
    const response = await request(path, { headers: { Authorization: "caller-credential", Cookie: "private-cookie" } });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject(body);
    expect(outbound).toHaveBeenCalledTimes(calls);
    for (const [input, init] of outbound.mock.calls) {
      const url = new URL(String(input));
      expect(url.origin).toBe("https://api.themoviedb.org");
      expect(url.search).not.toContain(TOKEN);
      expect(init?.redirect).toBe("manual");
      expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${TOKEN}`);
      expect(new Headers(init?.headers).has("Cookie")).toBe(false);
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
    expect(logs).toHaveBeenCalledTimes(1);
    expect(JSON.parse(logs.mock.calls[0][0])).toMatchObject({ route, status: 200, requestId: response.headers.get("X-Request-ID"), cache: "bypass" });
  });

  it("logs only safe fields for successes, validation failures, denied origins, preflight and upstream failures", async () => {
    const query = "sensitive-query-text";
    const upstreamPayload = "private-upstream-payload";
    const responses = [
      await request(`/search?query=${query}`, { headers: { Authorization: "private-caller-token", "CF-Connecting-IP": "192.0.2.123" } }),
      await request("/private-path-marker?query=private-query"),
      await request("/discovery", { headers: { Origin: "https://private-origin.example" } }),
      await request("/discovery", { method: "OPTIONS" }),
    ];
    outbound.mockResolvedValue(new Response(upstreamPayload, { status: 500 }));
    responses.push(await request(`/search?query=${query}`));
    expect(logs).toHaveBeenCalledTimes(5);
    for (const [index, args] of logs.mock.calls.entries()) {
      expect(args).toHaveLength(1);
      const event = JSON.parse(args[0]);
      expect(Object.keys(event).sort()).toEqual(["cache", "durationMs", "requestId", "route", "status"]);
      expect(event).toMatchObject({
        requestId: responses[index].headers.get("X-Request-ID"),
        route: ["search", "unmatched", "unmatched", "unmatched", "search"][index],
        status: [200, 404, 403, 204, 502][index],
        cache: "bypass",
      });
      expect(Number.isFinite(event.durationMs)).toBe(true);
      expect(event.durationMs).toBeGreaterThanOrEqual(0);
    }
    const output = JSON.stringify(logs.mock.calls);
    for (const privateValue of [TOKEN, query, upstreamPayload, "https://showtime.test", "private-path-marker", "private-query", "private-caller-token", "192.0.2.123", "private-origin"]) {
      expect(output).not.toContain(privateValue);
    }
    expect(await responses[4].text()).not.toContain(upstreamPayload);
  });
});
