// Sends transactional emails via the Resend API (https://resend.com).
// Deliberately optional: when no API key/from-address is configured, callers
// fall back to returning dev tokens directly in the API response (see
// api/auth.ts). This lets the accounts feature work end-to-end in local/dev
// environments before a domain is verified with Resend for real sending.
export type EmailConfig = {
  apiKey: string;
  from: string;
  appName: string;
  verificationTemplateId?: string;
};

export type MailerDeps = { config: EmailConfig | null; sendEmail?: typeof sendEmail };

export async function sendEmail(
  config: EmailConfig,
  message: { to: string; subject: string; html: string; text: string },
): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: config.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
}

export async function sendVerificationEmail(
  config: EmailConfig,
  to: string,
  verificationUrl: string,
): Promise<void> {
  if (!config.verificationTemplateId) {
    const message = verificationEmail(config.appName, verificationUrl);
    return sendEmail(config, { to, ...message });
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: config.from,
      to,
      template: {
        id: config.verificationTemplateId,
        variables: { verification_url: verificationUrl },
      },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend template request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
}

const BRAND_NAME = "SHOWTIME";
const BRAND_TAGLINE = "TRACK • WATCH • DISCOVER";

function wrapHtml(_appName: string, heading: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#0B0B0F;font-family:Arial,Helvetica,sans-serif;color:#DDDEE3;line-height:1.5">
<main style="max-width:560px;margin:0 auto;padding:32px 24px">
<header style="margin-bottom:32px">
<p style="margin:0;color:#D6A832;font-size:28px;font-weight:700;letter-spacing:1px">${BRAND_NAME}</p>
<p style="margin:6px 0 0;color:#D8D8D8;font-size:11px;letter-spacing:3px">${BRAND_TAGLINE}</p>
</header>
<section style="background:#111318;border-radius:12px;padding:24px">
<h2 style="margin:0 0 16px;color:#FFFFFF">${heading}</h2>
${bodyHtml}
</section>
<p style="color:#A7A7B0;font-size:12px;margin:24px 0 0">${BRAND_NAME}</p>
</main>
</body></html>`;
}

export function verificationEmail(appName: string, verificationUrl: string) {
  return {
    subject: `Verify your ${appName} email`,
    html: wrapHtml(
      appName,
      "Verify your email",
      `<p>Select the link below to verify your email and enable sync across devices:</p>
<p><a href="${verificationUrl}">Verify your email</a></p>
<p>This link expires in 24 hours. If you didn't create this account, you can ignore this email.</p>`,
    ),
    text: `Verify your ${appName} email: ${verificationUrl}\nThis link expires in 24 hours.`,
  };
}

export function passwordResetEmail(appName: string, token: string) {
  return {
    subject: `Reset your ${appName} password`,
    html: wrapHtml(
      appName,
      "Reset your password",
      `<p>Enter this code in the app to reset your password:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:2px">${token}</p>
<p>This code expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
    ),
    text: `Reset your ${appName} password by entering this code in the app: ${token}\nThis code expires in 1 hour.`,
  };
}
