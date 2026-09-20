import { describe, expect, it, vi } from "vitest";
import { enforceRateLimits } from "../src/rate-limit";

function limiter(success: boolean) {
  return { limit: vi.fn().mockResolvedValue({ success }) };
}

function env(search: ReturnType<typeof limiter>, discovery = search, details = search, work = search) {
  return {
    SEARCH_LIMITER: search,
    DISCOVERY_LIMITER: discovery,
    DETAILS_LIMITER: details,
    WORK_LIMITER: work,
  };
}

describe("Worker rate limits", () => {
  it.each([
    ["search", 1, "SEARCH_LIMITER"],
    ["discovery", 2, "DISCOVERY_LIMITER"],
    ["movie-details", 4, "DETAILS_LIMITER"],
    ["tv-details", 5, "DETAILS_LIMITER"],
    ["season-details", 1, "DETAILS_LIMITER"],
    ["person-details", 1, "DETAILS_LIMITER"],
  ] as const)("selects the %s category and charges %d work units", async (kind, cost, category) => {
    const search = limiter(true);
    const discovery = limiter(true);
    const details = limiter(true);
    const work = limiter(true);
    const result = await enforceRateLimits({ kind, cost }, env(search, discovery, details, work), "203.0.113.1");

    expect(result).toBe(true);
    const selected = category === "SEARCH_LIMITER"
      ? search
      : category === "DISCOVERY_LIMITER" ? discovery : details;
    expect(selected.limit).toHaveBeenCalledWith({ key: "203.0.113.1" });
    expect(work.limit).toHaveBeenCalledTimes(cost);
  });

  it("uses anonymous when the caller has no IP", async () => {
    const category = limiter(true);
    const work = limiter(true);
    await enforceRateLimits({ kind: "search", cost: 1 }, env(category, category, category, work), "anonymous");
    expect(category.limit).toHaveBeenCalledWith({ key: "anonymous" });
    expect(work.limit).toHaveBeenCalledWith({ key: "anonymous" });
  });

  it("stops before work when the category rejects", async () => {
    const category = limiter(false);
    const work = limiter(true);
    expect(await enforceRateLimits({ kind: "movie-details", cost: 4 }, env(category, category, category, work), "key"))
      .toBe(false);
    expect(work.limit).not.toHaveBeenCalled();
  });

  it("stops charging work after the first rejected unit", async () => {
    const category = limiter(true);
    const work = {
      limit: vi.fn()
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false }),
    };
    expect(await enforceRateLimits({ kind: "movie-details", cost: 4 }, env(category, category, category, work), "key"))
      .toBe(false);
    expect(work.limit).toHaveBeenCalledTimes(2);
  });
});
