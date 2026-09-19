import { afterEach, describe, expect, it, vi } from "vitest";
import { passwordResetEmail, sendEmail, sendVerificationEmail, verificationEmail } from "../src/email";

const CONFIG = { apiKey: "re_test_key", from: "Showtime <noreply@showtimetracker.show>", appName: "Showtime" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sendEmail", () => {
  it("posts to the Resend API with the expected payload and auth header", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));

    await sendEmail(CONFIG, { to: "user@example.com", subject: "Hi", html: "<p>hi</p>", text: "hi" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer re_test_key", "Content-Type": "application/json" });
    const body = JSON.parse(init?.body as string);
    expect(body).toMatchObject({ from: CONFIG.from, to: "user@example.com", subject: "Hi", html: "<p>hi</p>", text: "hi" });
  });

  it("throws when Resend responds with a non-2xx status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad request", { status: 422 }));
    await expect(
      sendEmail(CONFIG, { to: "user@example.com", subject: "Hi", html: "<p>hi</p>", text: "hi" }),
    ).rejects.toThrow(/422/);
  });

  it("sends the verification URL through the configured Resend template variable", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const verificationUrl = "https://showtime.test/auth/verify-email?token=abc123";

    await sendVerificationEmail(
      { ...CONFIG, verificationTemplateId: "92d2a801-c7fb-4030-bba0-5e70c1d697ac" },
      "user@example.com",
      verificationUrl,
    );

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({
      from: CONFIG.from,
      to: "user@example.com",
      template: {
        id: "92d2a801-c7fb-4030-bba0-5e70c1d697ac",
        variables: { verification_url: verificationUrl },
      },
    });
  });
});

describe("email templates", () => {
  it("includes the verification link and app name in the fallback verification email", () => {
    const email = verificationEmail("Showtime", "https://showtime.test/auth/verify-email?token=abc123");
    expect(email.subject).toContain("Showtime");
    expect(email.html).toContain("abc123");
    expect(email.text).toContain("abc123");
  });

  it("includes the token and app name in the password reset email", () => {
    const email = passwordResetEmail("Showtime", "reset456");
    expect(email.subject).toContain("Showtime");
    expect(email.html).toContain("reset456");
    expect(email.text).toContain("reset456");
  });
});
