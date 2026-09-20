import { describe, expect, it } from "vitest";
import config from "../wrangler.jsonc?raw";

describe("production API configuration", () => {
  it("preserves deployed resource identities", async () => {
    expect(config).toMatch(/"name"\s*:\s*"showtime-api"/);
    expect(config).toMatch(/"main"\s*:\s*"src\/index\.ts"/);
    expect(config).toMatch(/"pattern"\s*:\s*"api\.showtimetracker\.show"/);
    expect(config).toMatch(/"custom_domain"\s*:\s*true/);
    expect(config).toMatch(/"ALLOWED_ORIGINS"\s*:\s*"https:\/\/showtimetracker\.show"/);
    expect(config).toMatch(/"binding"\s*:\s*"SHOWTIME_DB"/);
    expect(config).toMatch(/"database_name"\s*:\s*"showtime-db"/);
    expect(config).toMatch(/"database_id"\s*:\s*"26791329-ad1c-44f3-bcbd-c0340c979e41"/);
  });
});
