import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("Showtime Worker foundation", () => {
  it("rejects an unmatched route through the deployed entrypoint", async () => {
    const response = await exports.default.fetch("https://showtime.test/");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found." });
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
