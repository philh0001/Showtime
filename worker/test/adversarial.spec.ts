import { describe, expect, it } from "vitest";
import { parseApiRequest } from "../../shared/tmdb-api/request.mjs";

describe("request adversarial boundaries", () => {
  it.each([
    "/details/%2e%2e/movie/1",
    "/details/%252e%252e/movie/1",
    "/details/movie/1?unknown=value",
    "/discovery?unknown=value",
  ])("rejects malformed or unexpected input: %s", (url) => {
    const result = parseApiRequest({ method: "GET", url: `https://showtime.test${url}` });
    expect("ok" in result && result.ok).toBe(false);
  });

  it("rejects oversized URLs before any route can be selected", () => {
    const result = parseApiRequest({
      method: "GET",
      url: `https://showtime.test/search?query=${"x".repeat(2100)}`,
    });
    expect(result).toMatchObject({ ok: false, status: 414 });
  });

  it("rejects methods outside the public contract", () => {
    expect(parseApiRequest({ method: "POST", url: "https://showtime.test/discovery" }))
      .toMatchObject({ ok: false, status: 405, allow: "GET, OPTIONS" });
  });
});
