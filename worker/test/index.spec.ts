import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("Showtime Worker foundation", () => {
  it("returns the deployment smoke response", async () => {
    const response = await exports.default.fetch("https://showtime.test/");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Showtime API is live");
  });
});
