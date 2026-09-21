import { describe, expect, it, vi } from "vitest";
import { withApiCache } from "../src/cache";

function cache() {
  const entries = new Map<string, Response>();
  return {
    match: vi.fn(async (request: Request) => entries.get(request.url)?.clone()),
    put: vi.fn(async (request: Request, response: Response) => {
      entries.set(request.url, response.clone());
    }),
  } as unknown as Cache;
}

const context = { waitUntil: (promise: Promise<unknown>) => promise };

describe("Worker API cache", () => {
  it("bypasses search", async () => {
    const load = vi.fn().mockResolvedValue({ status: 200, body: { results: [] } });
    const result = await withApiCache({ kind: "search", cacheKey: "/search?query=x" }, cache(), load, context);
    expect(result.outcome).toBe("bypass");
    expect(load).toHaveBeenCalledOnce();
  });

  it("stores and reuses discovery responses", async () => {
    const store = cache();
    const load = vi.fn().mockResolvedValue({ status: 200, body: { movies: [], tv: [] } });
    const first = await withApiCache({ kind: "discovery", cacheKey: "/discovery" }, store, load, context);
    await Promise.resolve();
    const second = await withApiCache({ kind: "discovery", cacheKey: "/discovery" }, store, load, context);
    expect(first.outcome).toBe("miss");
    expect(second).toEqual({ outcome: "hit", result: { status: 200, body: { movies: [], tv: [] } } });
    expect(load).toHaveBeenCalledOnce();
    expect(store.put).toHaveBeenCalledOnce();
    const stored = await store.match(new Request("https://showtime-api.internal/discovery"));
    expect(stored?.headers.get("Cache-Control")).toBe("max-age=1800");
    expect(stored?.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(stored?.headers.get("Vary")).toBeNull();
    expect(stored?.headers.get("X-Request-ID")).toBeNull();
  });

  it.each(["movie-details", "tv-details", "season-details", "person-details"])(
    "uses a ten-minute TTL for %s",
    async (kind) => {
      const store = cache();
      await withApiCache({ kind, cacheKey: `/details/${kind}` }, store, async () => ({
        status: 200,
        body: {},
      }), context);
      await Promise.resolve();
      const stored = await store.match(new Request(`https://showtime-api.internal/details/${kind}`));
      expect(stored?.headers.get("Cache-Control")).toBe("max-age=600");
    },
  );

  it("does not store errors", async () => {
    const store = cache();
    await withApiCache({ kind: "discovery", cacheKey: "/discovery" }, store, async () => ({
      status: 502,
      body: { error: "unavailable" },
    }), context);
    expect(store.put).not.toHaveBeenCalled();
  });

  it("stores complete schedules for ten minutes and bypasses temporary partials", async () => {
    const store = cache();
    const route = { kind: "tv-schedule", cacheKey: "/schedule/tv/123" };
    await withApiCache(route, store, async () => ({ status: 200, body: { schedule: {
      seasonCoverage: [{ seasonNumber: 1, status: "unavailable" }],
    } } }), context);
    expect(store.put).not.toHaveBeenCalled();
    await withApiCache(route, store, async () => ({ status: 200, body: { schedule: {
      seasonCoverage: [{ seasonNumber: 1, status: "checked" }],
    } } }), context);
    expect(store.put).toHaveBeenCalledOnce();
    const stored = await store.match(new Request("https://showtime-api.internal/schedule/tv/123"));
    expect(stored?.headers.get("Cache-Control")).toBe("max-age=600");
  });
});
