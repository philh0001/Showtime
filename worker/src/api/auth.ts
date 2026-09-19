// Pure-ish auth route handlers: given a parsed body and a D1 dependency,
// return { status, body }. Verification and reset tokens are emailed via
// Resend when `email.config` is set (see ../email.ts); until a domain is
// verified with Resend, `email.config` is null and these tokens are instead
// returned directly in the response (dev* fields) so the app still works
// end-to-end in development.
import { hashPassword, newId, randomToken, sha256Hex, verifyPassword } from "../auth/crypto";
import { passwordResetEmail, sendEmail, verificationEmail, type EmailConfig } from "../email";
import {
  createIdentity,
  createResetToken,
  createSession,
  createUser,
  createVerificationToken,
  deleteSessionByTokenHash,
  deleteSessionsByUserId,
  findActiveResetToken,
  findActiveVerificationToken,
  findSessionByTokenHash,
  findUserByEmail,
  findUserById,
  markEmailVerified,
  markResetTokenUsed,
  markVerificationTokenUsed,
  updatePasswordHash,
  type UserRow,
} from "../auth/db";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Deps = { db: D1Database; now: () => number; email: EmailConfig | null };
export type ApiResult = { status: number; body: unknown };

// Best-effort: a delivery failure (bad API key, Resend outage, etc.) should
// not prevent account creation/reset-request from succeeding, since the
// token is already stored and the dev fallback still reveals it in logs.
async function trySendEmail(email: EmailConfig | null, to: string, message: { subject: string; html: string; text: string }): Promise<boolean> {
  if (!email) return false;
  try {
    await sendEmail(email, { to, ...message });
    return true;
  } catch (error) {
    console.error("Failed to send email", error);
    return false;
  }
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 && trimmed.length <= 254 && EMAIL_RE.test(trimmed) ? trimmed : null;
}

function isValidPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 10 && value.length <= 200
    && /[A-Za-z]/.test(value) && /[0-9]/.test(value);
}

function publicUser(user: UserRow) {
  return { id: user.id, email: user.email, emailVerified: user.email_verified === 1 };
}

async function issueSession(db: D1Database, userId: string, now: () => number, deviceLabel: string | null): Promise<string> {
  const token = randomToken();
  await createSession(db, {
    id: newId(),
    userId,
    tokenHash: await sha256Hex(token),
    deviceLabel,
    expiresAt: new Date(now() + SESSION_TTL_MS).toISOString(),
  });
  return token;
}

export async function handleSignup(body: unknown, { db, now, email: emailConfig }: Deps): Promise<ApiResult> {
  const record = body as { email?: unknown; password?: unknown };
  const email = normalizeEmail(record?.email);
  if (!email) return { status: 400, body: { error: "Enter a valid email address." } };
  if (!isValidPassword(record?.password)) {
    return { status: 400, body: { error: "Password must be at least 10 characters and include a letter and a number." } };
  }
  if (await findUserByEmail(db, email)) return { status: 409, body: { error: "An account with this email already exists." } };

  const userId = newId();
  await createUser(db, { id: userId, email, passwordHash: await hashPassword(record.password) });
  await createIdentity(db, { id: newId(), userId, provider: "password", providerUserId: email });

  const verificationToken = randomToken();
  await createVerificationToken(db, {
    id: newId(),
    userId,
    tokenHash: await sha256Hex(verificationToken),
    expiresAt: new Date(now() + VERIFY_TTL_MS).toISOString(),
  });
  const sessionToken = await issueSession(db, userId, now, null);
  const emailed = await trySendEmail(emailConfig, email, verificationEmail(emailConfig?.appName ?? "Showtime", verificationToken));

  return {
    status: 201,
    body: {
      user: { id: userId, email, emailVerified: false },
      sessionToken,
      ...(emailed ? {} : { devVerificationToken: verificationToken }),
    },
  };
}

export async function handleLogin(body: unknown, { db, now }: Deps): Promise<ApiResult> {
  const record = body as { email?: unknown; password?: unknown; deviceLabel?: unknown };
  const email = normalizeEmail(record?.email);
  const password = record?.password;
  const genericFailure: ApiResult = { status: 401, body: { error: "Incorrect email or password." } };
  if (!email || typeof password !== "string" || !password) return genericFailure;

  const user = await findUserByEmail(db, email);
  if (!user?.password_hash || !(await verifyPassword(password, user.password_hash))) return genericFailure;

  const deviceLabel = typeof record.deviceLabel === "string" ? record.deviceLabel.trim().slice(0, 100) || null : null;
  const sessionToken = await issueSession(db, user.id, now, deviceLabel);
  return { status: 200, body: { user: publicUser(user), sessionToken } };
}

export async function handleLogout(token: string | null, { db }: Deps): Promise<ApiResult> {
  if (token) await deleteSessionByTokenHash(db, await sha256Hex(token));
  return { status: 204, body: null };
}

export async function resolveSession(token: string | null, { db, now }: Deps): Promise<UserRow | null> {
  if (!token) return null;
  const session = await findSessionByTokenHash(db, await sha256Hex(token));
  if (!session || new Date(session.expires_at).getTime() <= now()) return null;
  return findUserById(db, session.user_id);
}

export async function handleSessionInfo(token: string | null, deps: Deps): Promise<ApiResult> {
  const user = await resolveSession(token, deps);
  if (!user) return { status: 401, body: { error: "Sign in again." } };
  return { status: 200, body: { user: publicUser(user) } };
}

export async function handleVerifyEmail(body: unknown, { db }: Deps): Promise<ApiResult> {
  const token = (body as { token?: unknown })?.token;
  if (typeof token !== "string" || !token) return { status: 400, body: { error: "A verification token is required." } };
  const record = await findActiveVerificationToken(db, await sha256Hex(token));
  if (!record) return { status: 400, body: { error: "This verification link is invalid or has expired." } };
  await markEmailVerified(db, record.user_id);
  await markVerificationTokenUsed(db, record.id);
  return { status: 200, body: { verified: true } };
}

export async function handleRequestPasswordReset(body: unknown, { db, now, email: emailConfig }: Deps): Promise<ApiResult> {
  const email = normalizeEmail((body as { email?: unknown })?.email);
  if (!email) return { status: 400, body: { error: "Enter a valid email address." } };
  const user = await findUserByEmail(db, email);
  // Always return 200 so the response cannot be used to test which emails
  // have accounts; devResetToken is only present when a reset was created
  // and no email could be sent.
  if (!user) return { status: 200, body: { requested: true } };

  const resetToken = randomToken();
  await createResetToken(db, {
    id: newId(),
    userId: user.id,
    tokenHash: await sha256Hex(resetToken),
    expiresAt: new Date(now() + RESET_TTL_MS).toISOString(),
  });
  const emailed = await trySendEmail(emailConfig, email, passwordResetEmail(emailConfig?.appName ?? "Showtime", resetToken));
  return { status: 200, body: { requested: true, ...(emailed ? {} : { devResetToken: resetToken }) } };
}

export async function handleResetPassword(body: unknown, { db }: Deps): Promise<ApiResult> {
  const record = body as { token?: unknown; password?: unknown };
  if (typeof record?.token !== "string" || !record.token) return { status: 400, body: { error: "A reset token is required." } };
  if (!isValidPassword(record.password)) {
    return { status: 400, body: { error: "Password must be at least 10 characters and include a letter and a number." } };
  }
  const tokenRecord = await findActiveResetToken(db, await sha256Hex(record.token));
  if (!tokenRecord) return { status: 400, body: { error: "This reset link is invalid or has expired." } };

  await updatePasswordHash(db, tokenRecord.user_id, await hashPassword(record.password));
  await markResetTokenUsed(db, tokenRecord.id);
  // Sign out every device on password change.
  await deleteSessionsByUserId(db, tokenRecord.user_id);
  return { status: 200, body: { reset: true } };
}
