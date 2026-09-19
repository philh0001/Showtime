// Sends transactional emails via the Resend API (https://resend.com).
// Deliberately optional: when no API key/from-address is configured, callers
// fall back to returning dev tokens directly in the API response (see
// api/auth.ts). This lets the accounts feature work end-to-end in local/dev
// environments before a domain is verified with Resend for real sending.
export type EmailConfig = { apiKey: string; from: string; appName: string };

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

function wrapHtml(appName: string, heading: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="font-family:sans-serif;color:#1a1a1a;line-height:1.5">
<h2>${heading}</h2>
${bodyHtml}
<p style="color:#666;font-size:12px;margin-top:32px">${appName}</p>
</body></html>`;
}

export function verificationEmail(appName: string, token: string) {
  return {
    subject: `Verify your ${appName} email`,
    html: wrapHtml(
      appName,
      "Verify your email",
      `<p>Enter this code in the app to verify your email and enable sync across devices:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:2px">${token}</p>
<p>This code expires in 24 hours. If you didn't create this account, you can ignore this email.</p>`,
    ),
    text: `Verify your ${appName} email by entering this code in the app: ${token}\nThis code expires in 24 hours.`,
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
