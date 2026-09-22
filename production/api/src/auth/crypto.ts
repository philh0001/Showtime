// Password hashing, token generation and hashing. Runs entirely on
// Workers-runtime WebCrypto; no external dependency is required.
// Workers' WebCrypto implementation caps PBKDF2 at 100,000 iterations
// (throws NotSupportedError above that), unlike Node/Miniflare which allow
// more. Use the maximum Workers supports.
const ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function derivePbkdf2Bits(password: string, salt: Uint8Array, iterations: number, lengthBits: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, keyMaterial, lengthBits);
  return new Uint8Array(bits);
}

// Encodes as `pbkdf2$<iterations>$<saltB64url>$<hashB64url>` so the
// iteration count and salt travel with the hash for future upgrades.
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePbkdf2Bits(password, salt, ITERATIONS, KEY_LENGTH_BITS);
  return `pbkdf2$${ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations <= 0 || iterations > 1_000_000) return false;
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = fromBase64Url(parts[2]);
    expected = fromBase64Url(parts[3]);
  } catch {
    return false;
  }
  const actual = await derivePbkdf2Bits(password, salt, iterations, expected.length * 8);
  if (actual.length !== expected.length) return false;
  // Constant-time comparison to avoid leaking hash contents via timing.
  let diff = 0;
  for (let index = 0; index < actual.length; index += 1) diff |= actual[index] ^ expected[index];
  return diff === 0;
}

export function randomToken(bytes = 32): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function newId(): string {
  return crypto.randomUUID();
}
