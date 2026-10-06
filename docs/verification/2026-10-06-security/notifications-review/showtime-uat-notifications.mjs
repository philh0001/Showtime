var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/uint8array-extras/index.js
var objectToString = Object.prototype.toString;
var uint8ArrayStringified = "[object Uint8Array]";
var arrayBufferStringified = "[object ArrayBuffer]";
function isType(value, typeConstructor, typeStringified) {
  if (!value) {
    return false;
  }
  if (value.constructor === typeConstructor) {
    return true;
  }
  return objectToString.call(value) === typeStringified;
}
__name(isType, "isType");
function isUint8Array(value) {
  return isType(value, Uint8Array, uint8ArrayStringified);
}
__name(isUint8Array, "isUint8Array");
function isArrayBuffer(value) {
  return isType(value, ArrayBuffer, arrayBufferStringified);
}
__name(isArrayBuffer, "isArrayBuffer");
function isUint8ArrayOrArrayBuffer(value) {
  return isUint8Array(value) || isArrayBuffer(value);
}
__name(isUint8ArrayOrArrayBuffer, "isUint8ArrayOrArrayBuffer");
function toUint8ArrayIfArrayBuffer(value) {
  return isArrayBuffer(value) ? new Uint8Array(value) : value;
}
__name(toUint8ArrayIfArrayBuffer, "toUint8ArrayIfArrayBuffer");
function assertUint8ArrayOrArrayBuffer(value) {
  if (!isUint8ArrayOrArrayBuffer(value)) {
    throw new TypeError(`Expected \`Uint8Array\` or \`ArrayBuffer\`, got \`${typeof value}\``);
  }
}
__name(assertUint8ArrayOrArrayBuffer, "assertUint8ArrayOrArrayBuffer");
function toUint8Array(value) {
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new TypeError(`Unsupported value, got \`${typeof value}\`.`);
}
__name(toUint8Array, "toUint8Array");
function concatUint8Arrays(arrays, totalLength) {
  if (arrays.length === 0) {
    return new Uint8Array(0);
  }
  totalLength ??= arrays.reduce((accumulator, currentValue) => accumulator + currentValue.byteLength, 0);
  const returnValue = new Uint8Array(totalLength);
  let offset = 0;
  for (let array of arrays) {
    assertUint8ArrayOrArrayBuffer(array);
    array = toUint8ArrayIfArrayBuffer(array);
    returnValue.set(array, offset);
    offset += array.length;
  }
  return returnValue;
}
__name(concatUint8Arrays, "concatUint8Arrays");
var cachedDecoders = {
  utf8: new globalThis.TextDecoder("utf8")
};
function assertString(value) {
  if (typeof value !== "string") {
    throw new TypeError(`Expected \`string\`, got \`${typeof value}\``);
  }
}
__name(assertString, "assertString");
var cachedEncoder = new globalThis.TextEncoder();
function stringToUint8Array(string) {
  assertString(string);
  return cachedEncoder.encode(string);
}
__name(stringToUint8Array, "stringToUint8Array");
function base64ToBase64Url(base64) {
  return base64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
__name(base64ToBase64Url, "base64ToBase64Url");
function base64UrlToBase64(base64url) {
  const base64 = base64url.replaceAll("-", "+").replaceAll("_", "/");
  const padding = (4 - base64.length % 4) % 4;
  return base64 + "=".repeat(padding);
}
__name(base64UrlToBase64, "base64UrlToBase64");
var MAX_BLOCK_SIZE = 65535;
function uint8ArrayToBase64(array, { urlSafe = false } = {}) {
  assertUint8ArrayOrArrayBuffer(array);
  array = toUint8ArrayIfArrayBuffer(array);
  let base64 = "";
  for (let index = 0; index < array.length; index += MAX_BLOCK_SIZE) {
    const chunk = array.subarray(index, index + MAX_BLOCK_SIZE);
    base64 += globalThis.btoa(String.fromCodePoint.apply(void 0, chunk));
  }
  return urlSafe ? base64ToBase64Url(base64) : base64;
}
__name(uint8ArrayToBase64, "uint8ArrayToBase64");
function base64ToUint8Array(base64String) {
  assertString(base64String);
  return Uint8Array.from(globalThis.atob(base64UrlToBase64(base64String)), (x) => x.codePointAt(0));
}
__name(base64ToUint8Array, "base64ToUint8Array");
var byteToHexLookupTable = Array.from({ length: 256 }, (_, index) => index.toString(16).padStart(2, "0"));

// node_modules/@block65/webcrypto-web-push/dist/lib/utils.js
function encodeRecordSize(size) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, size);
  return bytes;
}
__name(encodeRecordSize, "encodeRecordSize");
function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
__name(invariant, "invariant");

// node_modules/@block65/webcrypto-web-push/dist/lib/client-keys.js
async function deriveClientKeys(sub) {
  const bytes = base64ToUint8Array(sub.keys.p256dh);
  const authSecretBytes = base64ToUint8Array(sub.keys.auth);
  invariant(bytes.byteLength === 65 && bytes[0] === 4, "Subscription p256dh is not an uncompressed P-256 point");
  invariant(authSecretBytes.byteLength === 16, "Subscription auth secret is not 16 bytes");
  return {
    publicKeyBytes: bytes,
    publicKey: await crypto.subtle.importKey("raw", bytes, {
      name: "ECDH",
      namedCurve: "P-256"
    }, false, []),
    authSecretBytes
  };
}
__name(deriveClientKeys, "deriveClientKeys");

// node_modules/@block65/webcrypto-web-push/dist/lib/hkdf.js
function createHMAC(data) {
  const keyPromise = crypto.subtle.importKey("raw", data, {
    name: "HMAC",
    hash: "SHA-256"
  }, false, ["sign"]);
  return {
    hash: /* @__PURE__ */ __name(async (input) => {
      const k = await keyPromise;
      return crypto.subtle.sign("HMAC", k, input);
    }, "hash")
  };
}
__name(createHMAC, "createHMAC");
async function hkdf(salt, ikm) {
  const prkhPromise = createHMAC(salt).hash(ikm).then((prk) => createHMAC(prk));
  return {
    extract: /* @__PURE__ */ __name(async (info, len) => {
      const prkh = await prkhPromise;
      const blocks = await Array.from({ length: Math.ceil(len / 32) }, (_, i) => i).reduce(async (acc, i) => {
        const previous = await acc;
        const hash2 = await prkh.hash(new Uint8Array([...previous.at(-1) ?? [], ...info, i + 1]));
        return [...previous, new Uint8Array(hash2)];
      }, Promise.resolve([]));
      return concatUint8Arrays(blocks).slice(0, len);
    }, "extract")
  };
}
__name(hkdf, "hkdf");

// node_modules/@block65/webcrypto-web-push/dist/lib/info.js
function createKeyInfo(clientPublic, serverPublic) {
  return new Uint8Array([
    ...stringToUint8Array("WebPush: info\0"),
    ...clientPublic,
    ...serverPublic
  ]);
}
__name(createKeyInfo, "createKeyInfo");
function createInfo(type) {
  return stringToUint8Array(`Content-Encoding: ${type}\0`);
}
__name(createInfo, "createInfo");

// node_modules/@block65/webcrypto-web-push/dist/lib/local-keys.js
async function generateLocalKeys() {
  const keyPair = await crypto.subtle.generateKey({
    name: "ECDH",
    namedCurve: "P-256"
  }, false, ["deriveBits"]);
  return {
    privateKey: keyPair.privateKey,
    publicKeyBytes: new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey))
  };
}
__name(generateLocalKeys, "generateLocalKeys");

// node_modules/@block65/webcrypto-web-push/dist/lib/salt.js
async function getSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}
__name(getSalt, "getSalt");

// node_modules/@block65/webcrypto-web-push/dist/lib/encrypt.js
var recordSize = 4096;
var headerSize = 21 + 65;
var maxPlaintextSize = recordSize - headerSize - 17;
async function encryptNotification(subscription, plaintext, options = {}) {
  invariant(plaintext.byteLength <= maxPlaintextSize, `Payload is ${plaintext.byteLength} bytes, the maximum is ${maxPlaintextSize}`);
  const clientKeys = await deriveClientKeys(subscription);
  const salt = await getSalt();
  const localKeys = await generateLocalKeys();
  const sharedSecret = await crypto.subtle.deriveBits({
    name: "ECDH",
    public: clientKeys.publicKey
  }, localKeys.privateKey, 256);
  const keyInfo = createKeyInfo(clientKeys.publicKeyBytes, localKeys.publicKeyBytes);
  const cekInfo = createInfo("aes128gcm");
  const nonceInfo = createInfo("nonce");
  const ikmHkdf = await hkdf(clientKeys.authSecretBytes, sharedSecret);
  const ikm = await ikmHkdf.extract(keyInfo, 32);
  const messageHkdf = await hkdf(salt, ikm);
  const cekBytes = await messageHkdf.extract(cekInfo, 16);
  const nonceBytes = await messageHkdf.extract(nonceInfo, 12);
  const cekCryptoKey = await crypto.subtle.importKey("raw", cekBytes, {
    name: "AES-GCM",
    length: 128
  }, false, ["encrypt"]);
  const padTo = options.pad ?? true ? maxPlaintextSize : plaintext.byteLength;
  const padded = new Uint8Array(padTo + 1);
  padded.set(plaintext);
  padded[plaintext.byteLength] = 2;
  const encrypted = await crypto.subtle.encrypt({
    name: "AES-GCM",
    iv: nonceBytes
  }, cekCryptoKey, padded);
  return new Uint8Array([
    ...salt,
    ...encodeRecordSize(recordSize),
    localKeys.publicKeyBytes.byteLength,
    ...localKeys.publicKeyBytes,
    ...new Uint8Array(encrypted)
  ]);
}
__name(encryptNotification, "encryptNotification");

// node_modules/@block65/webcrypto-web-push/dist/lib/base64.js
function encodeBase64Url(value) {
  return uint8ArrayToBase64(toUint8Array(value), { urlSafe: true });
}
__name(encodeBase64Url, "encodeBase64Url");
function objectToBase64Url(obj) {
  return encodeBase64Url(stringToUint8Array(JSON.stringify(obj)));
}
__name(objectToBase64Url, "objectToBase64Url");

// node_modules/@block65/webcrypto-web-push/dist/lib/jwt.js
async function sign(payload, key) {
  const headerStr = objectToBase64Url({
    typ: "JWT",
    alg: "ES256"
  });
  const payloadStr = objectToBase64Url({
    iat: Math.floor(Date.now() / 1e3),
    ...payload
  });
  const dataStr = `${headerStr}.${payloadStr}`;
  const signature = await crypto.subtle.sign({
    name: "ECDSA",
    hash: "SHA-256"
  }, key, stringToUint8Array(dataStr));
  return `${dataStr}.${encodeBase64Url(signature)}`;
}
__name(sign, "sign");

// node_modules/@block65/webcrypto-web-push/dist/lib/vapid.js
async function vapidHeaders(subscription, vapid) {
  invariant(vapid.subject, "Vapid subject is empty");
  invariant(vapid.privateKey, "Vapid private key is empty");
  invariant(vapid.publicKey, "Vapid public key is empty");
  const endpoint = new URL(subscription.endpoint);
  invariant(endpoint.protocol === "https:", `Subscription endpoint is not https: ${endpoint.protocol}`);
  const vapidPublicKeyBytes = base64ToUint8Array(vapid.publicKey);
  const publicKey = await crypto.subtle.importKey("jwk", {
    kty: "EC",
    crv: "P-256",
    x: encodeBase64Url(vapidPublicKeyBytes.slice(1, 33)),
    y: encodeBase64Url(vapidPublicKeyBytes.slice(33, 65)),
    d: vapid.privateKey
  }, {
    name: "ECDSA",
    namedCurve: "P-256"
  }, false, ["sign"]);
  const jwt = await sign({
    aud: endpoint.origin,
    exp: Math.floor(Date.now() / 1e3) + 12 * 60 * 60,
    sub: vapid.subject
  }, publicKey);
  return {
    headers: {
      authorization: `vapid t=${jwt}, k=${vapid.publicKey}`
    }
  };
}
__name(vapidHeaders, "vapidHeaders");

// node_modules/@block65/webcrypto-web-push/dist/lib/payload.js
async function buildPushPayload(message, subscription, vapid) {
  const { headers } = await vapidHeaders(subscription, vapid);
  const body2 = await encryptNotification(subscription, stringToUint8Array(
    // if its a primitive, convert to string, otherwise stringify
    typeof message.data === "string" || typeof message.data === "number" ? message.data.toString() : JSON.stringify(message.data)
  ));
  return {
    headers: {
      ...headers,
      ttl: (message.options?.ttl || 60).toString(),
      ...message.options?.urgency && {
        urgency: message.options.urgency
      },
      ...message.options?.topic && {
        topic: message.options.topic
      },
      "content-encoding": "aes128gcm",
      "content-length": body2.byteLength.toString(),
      "content-type": "application/octet-stream"
    },
    method: "post",
    body: body2
  };
}
__name(buildPushPayload, "buildPushPayload");

// src/rules.mjs
function validPreferences(p) {
  return p?.version === 1 && typeof p.enabled === "boolean" && Array.isArray(p.showIds) && p.showIds.length <= 30 && p.showIds.every((id) => Number.isSafeInteger(id) && id > 0) && new Set(p.showIds).size === p.showIds.length && ["release-day", "day-before"].includes(p.timing) && typeof p.dailyDigest === "boolean" && typeof p.dateAnnouncements === "boolean" && Number.isInteger(p.hour) && p.hour >= 0 && p.hour <= 23 && typeof p.timezone === "string" && p.timezone.length <= 100 && validTimezone(p.timezone);
}
__name(validPreferences, "validPreferences");
function validTimezone(zone) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
__name(validTimezone, "validTimezone");
function validSubscription(s) {
  if (!s || typeof s.endpoint !== "string" || s.endpoint.length > 2048 || typeof s.keys?.p256dh !== "string" || typeof s.keys?.auth !== "string") return false;
  try {
    const u = new URL(s.endpoint);
    return u.href === s.endpoint && !u.hash && u.protocol === "https:" && !u.username && !u.password && !u.port && ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"].includes(u.hostname) && /^[A-Za-z0-9_-]{87}$/.test(s.keys.p256dh) && /^[A-Za-z0-9_-]{22}$/.test(s.keys.auth);
  } catch {
    return false;
  }
}
__name(validSubscription, "validSubscription");
function decodedKey(value, size) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw Error("encoding");
  const bytes = Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const canonical = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  if (bytes.length !== size || canonical !== value) throw Error("encoding");
  return bytes;
}
__name(decodedKey, "decodedKey");
async function validSubscriptionCrypto(s) {
  if (!validSubscription(s)) return false;
  try {
    const publicKey = decodedKey(s.keys.p256dh, 65);
    decodedKey(s.keys.auth, 16);
    if (publicKey[0] !== 4) return false;
    await crypto.subtle.importKey("raw", publicKey, { name: "ECDH", namedCurve: "P-256" }, false, []);
    return true;
  } catch {
    return false;
  }
}
__name(validSubscriptionCrypto, "validSubscriptionCrypto");
function localClock(now, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { date: `${v.year}-${v.month}-${v.day}`, hour: Number(v.hour), minute: Number(v.minute) };
}
__name(localClock, "localClock");
function releaseEvents(schedule, prefs, now, previousNext) {
  const clock = localClock(now, prefs.timezone);
  if (clock.hour !== prefs.hour) return [];
  const offset = prefs.timing === "day-before" ? 1 : 0;
  const d = /* @__PURE__ */ new Date(`${clock.date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  const target = d.toISOString().slice(0, 10);
  const episodes = validatedEpisodes(schedule).filter((e) => e.airDate === target);
  const events = episodes.length ? [{ key: `release:${schedule.id}:${target}:${prefs.timing}`, showId: schedule.id, title: schedule.title.slice(0, 120), body: `${offset ? "Tomorrow" : "Today"}: ${episodes.length === 1 ? `S${episodes[0].seasonNumber} E${episodes[0].episodeNumber}` : `${episodes.length} episodes`}. Original air date from TMDB.`, url: `/tv/${schedule.id}` }] : [];
  const next = nextAirDate(schedule, clock.date);
  if (prefs.dateAnnouncements && previousNext === null && next && next >= clock.date) events.push({ key: `announced:${schedule.id}:${next}`, showId: schedule.id, title: schedule.title.slice(0, 120), body: `A release date has been announced: ${next}.`, url: `/tv/${schedule.id}` });
  return events;
}
__name(releaseEvents, "releaseEvents");
function nextAirDate(schedule, today) {
  return [...schedule.episodes ?? [], ...schedule.nextEpisode ? [schedule.nextEpisode] : []].map((e) => e.airDate).filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && validDate(d) && d >= today).sort()[0] ?? null;
}
__name(nextAirDate, "nextAirDate");
function validatedEpisodes(schedule) {
  const result = [], seen = /* @__PURE__ */ new Set();
  for (const episode of [...schedule.episodes ?? [], ...schedule.nextEpisode ? [schedule.nextEpisode] : []]) {
    if (!episode || !Number.isSafeInteger(episode.seasonNumber) || episode.seasonNumber < 0 || !Number.isSafeInteger(episode.episodeNumber) || episode.episodeNumber < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(episode.airDate ?? "") || !validDate(episode.airDate)) continue;
    const identity = `${episode.seasonNumber}:${episode.episodeNumber}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    result.push(episode);
  }
  return result;
}
__name(validatedEpisodes, "validatedEpisodes");
function validDate(value) {
  const date = /* @__PURE__ */ new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
__name(validDate, "validDate");

// src/worker.mjs
var json = /* @__PURE__ */ __name((data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } }), "json");
function notificationCapacity(env) {
  const bounded = /* @__PURE__ */ __name((value, fallback, max) => {
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 && n <= max ? n : fallback;
  }, "bounded");
  return { devices: bounded(env.MAX_DEVICES, 4, 20), shows: bounded(env.MAX_DISTINCT_SHOWS, 24, 60), reads: bounded(env.MAX_SCHEDULE_READS, 4, 10) };
}
__name(notificationCapacity, "notificationCapacity");
async function hash(s) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((x) => x.toString(16).padStart(2, "0")).join("");
}
__name(hash, "hash");
async function body(request) {
  const reader = request.body?.getReader();
  if (!reader) throw Error("body");
  let timer;
  const read = /* @__PURE__ */ __name(async () => {
    let size = 0;
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 12e3) throw Error("large");
      chunks.push(value);
    }
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(chunks.flatMap((c) => [...c]))));
  }, "read");
  try {
    return await Promise.race([read(), new Promise((_, reject) => {
      timer = setTimeout(() => {
        void reader.cancel().catch(() => {
        });
        reject(Error("timeout"));
      }, 5e3);
    })]);
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {
    });
  }
}
__name(body, "body");
function credentials(request) {
  const id = request.headers.get("X-Device-Id"), token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
  return /^[a-f0-9]{32}$/.test(id ?? "") && /^[a-f0-9]{64}$/.test(token ?? "") ? { id, token } : null;
}
__name(credentials, "credentials");
var LEASE_MS = 180 * 864e5;
var RENEW_MS = 30 * 864e5;
async function subscriptionFingerprint(subscription) {
  return hash(JSON.stringify([subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]));
}
__name(subscriptionFingerprint, "subscriptionFingerprint");
async function deviceStatus(row, now) {
  const leaseExpiresAt = row.updated_at + LEASE_MS, expired = leaseExpiresAt <= now;
  return { enabled: !expired, expired, leaseExpiresAt, ...!expired ? { renewAfter: row.updated_at + RENEW_MS, subscriptionFingerprint: await subscriptionFingerprint(JSON.parse(row.subscription)) } : {} };
}
__name(deviceStatus, "deviceStatus");
var collision = /* @__PURE__ */ __name(() => json({ error: "This browser subscription is already registered. Re-enable alerts to replace it.", code: "subscription_in_use" }, 409), "collision");
async function handleRequest(request, env) {
  const capacity = notificationCapacity(env), url = new URL(request.url), now = Date.now();
  if (url.search) return json({ error: "Not found" }, 404);
  if (url.pathname === "/notifications/config" && request.method === "GET") return json({ publicKey: env.VAPID_PUBLIC_KEY ?? null, available: !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.DB && env.CONTENT_API) });
  if (url.pathname !== "/notifications/device" || !["GET", "PATCH", "PUT", "DELETE"].includes(request.method)) return json({ error: "Not found" }, 404);
  const auth = credentials(request);
  if (!auth) return json({ error: "Device authorization required" }, 401);
  const authHash = await hash(auth.token), existing = await env.DB.prepare("SELECT * FROM devices WHERE id=?").bind(auth.id).first();
  if (existing && existing.auth_hash !== authHash) return json({ error: "Device authorization failed" }, 403);
  if (request.method === "DELETE") {
    if (existing) await env.DB.batch([env.DB.prepare("DELETE FROM devices WHERE id=? AND auth_hash=?").bind(auth.id, authHash), env.DB.prepare("DELETE FROM delivery WHERE device_id=?").bind(auth.id), env.DB.prepare("DELETE FROM show_dates WHERE device_id=?").bind(auth.id)]);
    return json({ enabled: false });
  }
  if (["GET", "PATCH"].includes(request.method)) {
    if (!existing) return json({ error: "Enable notifications on this device first.", code: "device_missing" }, 404);
    if (request.method === "GET") return json(await deviceStatus(existing, now));
    const value2 = await body(request), fingerprint = await subscriptionFingerprint(JSON.parse(existing.subscription));
    if (existing.updated_at <= now - LEASE_MS) return json({ error: "Alerts expired. Enable them again.", code: "device_expired" }, 409);
    if (value2.subscriptionFingerprint !== fingerprint) return json({ error: "Browser subscription changed. Enable alerts again.", code: "subscription_changed" }, 409);
    const renewal = await env.DB.prepare("UPDATE devices SET updated_at=? WHERE id=? AND auth_hash=? AND subscription=? AND updated_at>? AND updated_at<=?").bind(now, auth.id, authHash, existing.subscription, now - LEASE_MS, now - RENEW_MS).run();
    const current = await env.DB.prepare("SELECT * FROM devices WHERE id=? AND auth_hash=?").bind(auth.id, authHash).first();
    if (!current) return json({ error: "Enable notifications on this device first.", code: "device_missing" }, 404);
    if (!renewal.meta.changes && current.subscription !== existing.subscription) return json({ error: "Browser subscription changed. Enable alerts again.", code: "subscription_changed" }, 409);
    return json(await deviceStatus(current, now));
  }
  const value = await body(request);
  if (!validPreferences(value.preferences) || !await validSubscriptionCrypto(value.subscription)) return json({ error: "Invalid notification settings" }, 400);
  if (!value.preferences.enabled || !value.preferences.showIds.length) return json({ error: "Select at least one show" }, 400);
  const endpoint = value.subscription.endpoint;
  if (await env.DB.prepare("SELECT id FROM devices WHERE json_extract(subscription,'$.endpoint')=? AND id<>?").bind(endpoint, auth.id).first()) return collision();
  if (!existing) {
    const bucket = await hash(`${request.headers.get("CF-Connecting-IP") ?? "shared"}:${Math.floor(now / 36e5)}`);
    const limit = await env.DB.prepare("INSERT INTO registration_limits(bucket,count,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count").bind(bucket, now + 72e5).first();
    if (limit.count > 10) return json({ error: "Please try again later" }, 429);
    const count = await env.DB.prepare("SELECT count(*) AS total FROM devices").first();
    if (count.total >= capacity.devices) return json({ error: `Notification capacity reached (${capacity.devices} devices).` }, 503);
  }
  const preferences = JSON.stringify(value.preferences), subscription = JSON.stringify(value.subscription);
  const upsert = env.DB.prepare(`INSERT INTO devices(id,auth_hash,subscription,preferences,updated_at)
 SELECT ?,?,?,?,? WHERE
 ((SELECT count(*) FROM devices)<? OR EXISTS(SELECT 1 FROM devices WHERE id=?))
 AND NOT EXISTS(SELECT 1 FROM devices WHERE json_extract(subscription,'$.endpoint')=? AND id<>?)
 AND (SELECT count(DISTINCT value) FROM (SELECT j.value FROM devices d,json_each(d.preferences,'$.showIds') j WHERE d.id<>? UNION SELECT value FROM json_each(?,'$.showIds')))<=?
 ON CONFLICT(id) DO UPDATE SET subscription=excluded.subscription,preferences=excluded.preferences,updated_at=excluded.updated_at WHERE devices.auth_hash=excluded.auth_hash`).bind(auth.id, authHash, subscription, preferences, now, capacity.devices, auth.id, endpoint, auth.id, auth.id, preferences, capacity.shows);
  const prune = env.DB.prepare("DELETE FROM show_dates WHERE changes()>0 AND device_id=? AND show_id NOT IN (SELECT value FROM json_each(?,'$.showIds')) AND EXISTS(SELECT 1 FROM devices WHERE id=? AND auth_hash=? AND subscription=? AND preferences=? AND updated_at=?)").bind(auth.id, preferences, auth.id, authHash, subscription, preferences, now);
  let saved;
  try {
    [saved] = await env.DB.batch([upsert, prune]);
  } catch (error) {
    if (String(error?.message).includes("UNIQUE constraint failed: index 'devices_endpoint'")) return collision();
    throw error;
  }
  if (!saved.meta.changes) {
    if (await env.DB.prepare("SELECT id FROM devices WHERE json_extract(subscription,'$.endpoint')=? AND id<>?").bind(endpoint, auth.id).first()) return collision();
    return json({ error: `Notification capacity reached. Up to ${capacity.devices} devices and ${capacity.shows} different shows can receive alerts.` }, 503);
  }
  return json({ enabled: true });
}
__name(handleRequest, "handleRequest");
function individualMessages(events) {
  const groups = /* @__PURE__ */ new Map();
  for (const event of events) {
    const group = groups.get(event.showId) ?? [];
    group.push(event);
    groups.set(event.showId, group);
  }
  return [...groups.values()].map((group) => {
    const primary = group.find((event) => event.key.startsWith("release:")) ?? group[0];
    const date = primary.key.split(":")[2];
    const extra = group.filter((event) => event !== primary && event.key.split(":")[2] !== date).map((event) => event.body);
    return { events: group, payload: { ...primary, body: [primary.body, ...extra].join(" ").slice(0, 500) } };
  });
}
__name(individualMessages, "individualMessages");
async function releaseUnsent(env, row, events, clock) {
  const owned = "EXISTS(SELECT 1 FROM devices WHERE id=? AND auth_hash=?)";
  await env.DB.prepare(`UPDATE delivery SET state='retry' WHERE device_id=? AND state='claimed' AND event_key IN (SELECT value FROM json_each(?)) AND ${owned}`).bind(row.id, JSON.stringify(events.map((event) => event.key)), row.id, row.auth_hash).run();
  if (row.prefs.dailyDigest) await env.DB.prepare(`UPDATE delivery SET state='retry' WHERE device_id=? AND event_key=? AND state='claimed' AND ${owned}`).bind(row.id, `digest:${clock.date}`, row.id, row.auth_hash).run();
}
__name(releaseUnsent, "releaseUnsent");
async function cleanup(env, now, cursor, metrics) {
  if (cursor?.last_cleanup_at > now - 36e5) return;
  const claimed = await env.DB.prepare("INSERT INTO schedule_cursor(id,cursor,last_cleanup_at) VALUES(1,0,?) ON CONFLICT(id) DO UPDATE SET last_cleanup_at=excluded.last_cleanup_at WHERE schedule_cursor.last_cleanup_at<=? RETURNING id").bind(now, now - 36e5).first();
  if (!claimed) return;
  metrics.cleanupAttempted = true;
  const backlog = await env.DB.prepare(`SELECT
 (SELECT count(*) FROM devices WHERE updated_at<=?) AS expiredDevices,
 (SELECT count(*) FROM delivery WHERE created_at<? OR NOT EXISTS(SELECT 1 FROM devices d WHERE d.id=delivery.device_id AND d.updated_at>?)) AS deliveryRows,
 (SELECT count(*) FROM registration_limits WHERE expires_at<=?) AS registrationRows,
 (SELECT count(*) FROM show_dates b WHERE NOT EXISTS(SELECT 1 FROM devices d WHERE d.id=b.device_id AND d.updated_at>? AND b.show_id IN (SELECT value FROM json_each(d.preferences,'$.showIds')))) AS baselineRows,
 (SELECT count(*) FROM delivery WHERE state IN ('pending','retry') AND created_at>=?) AS recentPendingRetryRows`).bind(now - LEASE_MS, now - 30 * 864e5, now - LEASE_MS, now, now - LEASE_MS, now - 30 * 864e5).first();
  const results = await env.DB.batch([
    env.DB.prepare("DELETE FROM devices WHERE rowid IN (SELECT rowid FROM devices WHERE updated_at<=? ORDER BY updated_at LIMIT 20) AND updated_at<=?").bind(now - LEASE_MS, now - LEASE_MS),
    env.DB.prepare("DELETE FROM delivery WHERE rowid IN (SELECT rowid FROM (SELECT rowid,created_at FROM delivery INDEXED BY delivery_created WHERE created_at<? UNION SELECT rowid,created_at FROM delivery WHERE NOT EXISTS(SELECT 1 FROM devices WHERE id=delivery.device_id)) ORDER BY created_at LIMIT 200)").bind(now - 30 * 864e5),
    env.DB.prepare("DELETE FROM registration_limits WHERE rowid IN (SELECT rowid FROM registration_limits WHERE expires_at<=? ORDER BY expires_at LIMIT 200)").bind(now),
    env.DB.prepare("DELETE FROM show_dates WHERE rowid IN (SELECT b.rowid FROM show_dates b WHERE NOT EXISTS(SELECT 1 FROM devices d WHERE d.id=b.device_id AND b.show_id IN (SELECT value FROM json_each(d.preferences,'$.showIds'))) LIMIT 200)")
  ]);
  metrics.cleanupBacklog = backlog;
  metrics.cleanupDeletedRows = { devices: results[0].meta.changes, delivery: results[1].meta.changes, registrationLimits: results[2].meta.changes, baselines: results[3].meta.changes };
  metrics.cleanupCaps = { devices: 20, delivery: 200, registrationLimits: 200, baselines: 200 };
  metrics.cleanupCapped = Object.values(metrics.cleanupDeletedRows).some((n, i) => n === [20, 200, 200, 200][i]);
  if (metrics.cleanupCapped) metrics.cleanupOperatorAction = "inspect_backlog_if_cap_repeats";
}
__name(cleanup, "cleanup");
function usableSchedule(schedule, id) {
  const episode = /* @__PURE__ */ __name((e) => e && typeof e === "object" && Number.isSafeInteger(e.seasonNumber) && e.seasonNumber >= 0 && Number.isSafeInteger(e.episodeNumber) && e.episodeNumber > 0 && (e.airDate === null || typeof e.airDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.airDate) && Number.isFinite(Date.parse(e.airDate + "T12:00:00Z")) && (/* @__PURE__ */ new Date(e.airDate + "T12:00:00Z")).toISOString().slice(0, 10) === e.airDate), "episode");
  return schedule && schedule.id === id && typeof schedule.title === "string" && ["complete", "partial"].includes(schedule.coverage) && Array.isArray(schedule.episodes) && schedule.episodes.every(episode) && (schedule.nextEpisode == null || episode(schedule.nextEpisode));
}
__name(usableSchedule, "usableSchedule");
async function runScheduled(env, now = /* @__PURE__ */ new Date()) {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY || !env.CONTENT_API) return;
  const started = Date.now(), deadline = started + 24e4;
  const metrics = { route: "notification-delivery", eligibleDevices: 0, selectedSchedules: 0, attemptedSchedules: 0, usableSchedules: 0, staleSchedules: 0, invalidSchedules: 0, throttledSchedules: 0, failedSchedules: 0, deferredSchedules: 0, sentMessages: 0, failedMessages: 0, preSendFailed: 0, ambiguousDispatchFailed: 0, dispatchAttempts: 0, deadlineReached: false, cleanupAttempted: false };
  const capacity = notificationCapacity(env);
  const rows = (await env.DB.prepare("SELECT *,EXISTS(SELECT 1 FROM delivery WHERE device_id=devices.id AND state IN ('pending','retry')) AS has_pending_work FROM devices WHERE updated_at>? LIMIT ?").bind(now.getTime() - LEASE_MS, capacity.devices).all()).results;
  const cursor = await env.DB.prepare("SELECT cursor,last_cleanup_at FROM schedule_cursor WHERE id=1").first();
  const due = rows.flatMap((row) => {
    try {
      const prefs = JSON.parse(row.preferences);
      return validPreferences(prefs) && prefs.enabled && localClock(now, prefs.timezone).hour === prefs.hour ? [{ ...row, prefs }] : [];
    } catch {
      metrics.invalidDevices = (metrics.invalidDevices ?? 0) + 1;
      return [];
    }
  });
  const allIds = [...new Set(due.flatMap((row) => row.prefs.showIds))].sort((a, b) => a - b), start = Number(cursor?.cursor ?? 0) % Math.max(1, allIds.length), ids = [...allIds.slice(start), ...allIds.slice(0, start)].slice(0, capacity.reads), schedules = /* @__PURE__ */ new Map();
  metrics.eligibleDevices = due.length;
  metrics.selectedSchedules = ids.length;
  let processed = 0;
  for (const id of ids) {
    if (Date.now() >= deadline) {
      metrics.deadlineReached = true;
      break;
    }
    metrics.attemptedSchedules++;
    try {
      const response = await env.CONTENT_API.fetch(new Request(`https://api.showtimetracker.show/schedule/tv/${id}`, { signal: AbortSignal.timeout(12e3) }));
      if (response.status === 429) {
        metrics.throttledSchedules++;
        break;
      }
      if (response.status >= 500) {
        metrics.failedSchedules++;
        break;
      }
      processed++;
      if (!response.ok) {
        metrics.failedSchedules++;
        continue;
      }
      let value;
      try {
        value = await response.json();
      } catch {
        metrics.invalidSchedules++;
        metrics.failedSchedules++;
        continue;
      }
      const { schedule, freshness } = value ?? {};
      if (freshness === "stale") {
        metrics.staleSchedules++;
        continue;
      }
      if (!usableSchedule(schedule, id)) {
        metrics.invalidSchedules++;
        metrics.failedSchedules++;
        continue;
      }
      schedules.set(id, schedule);
      metrics.usableSchedules++;
    } catch {
      metrics.failedSchedules++;
      break;
    }
  }
  metrics.deferredSchedules = ids.length - metrics.attemptedSchedules;
  if (ids.length && processed) await env.DB.prepare("INSERT INTO schedule_cursor(id,cursor) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET cursor=excluded.cursor").bind(start + processed).run();
  let sent = 0, failed = 0;
  for (const row of due) {
    if (!schedules.size && !row.has_pending_work) continue;
    const stillCurrent = /* @__PURE__ */ __name(() => env.DB.prepare("SELECT id FROM devices WHERE id=? AND auth_hash=? AND subscription=? AND preferences=?").bind(row.id, row.auth_hash, row.subscription, row.preferences).first(), "stillCurrent");
    if (!await stillCurrent()) continue;
    const previous = new Map((await env.DB.prepare("SELECT show_id,next_date FROM show_dates WHERE device_id=?").bind(row.id).all()).results.map((item) => [item.show_id, item.next_date]));
    const currentEvents = row.prefs.showIds.flatMap((id) => schedules.has(id) ? releaseEvents(schedules.get(id), row.prefs, now, previous.get(id)) : []);
    if (currentEvents.length) await env.DB.prepare("INSERT OR IGNORE INTO delivery(device_id,event_key,state,event_payload,created_at) SELECT ?,json_extract(value,'$.key'),'pending',value,? FROM json_each(?) WHERE EXISTS(SELECT 1 FROM devices WHERE id=? AND auth_hash=? AND subscription=? AND preferences=?)").bind(row.id, now.getTime(), JSON.stringify(currentEvents), row.id, row.auth_hash, row.subscription, row.preferences).run();
    const fresh = [];
    const clock = localClock(now, row.prefs.timezone);
    const target = /* @__PURE__ */ new Date(`${clock.date}T12:00:00Z`);
    if (row.prefs.timing === "day-before") target.setUTCDate(target.getUTCDate() + 1);
    if (row.prefs.dailyDigest && clock.minute >= 50) {
      const done = await env.DB.prepare("SELECT state FROM delivery WHERE device_id=? AND event_key=?").bind(row.id, `digest:${clock.date}`).first();
      if (done && done.state !== "retry") continue;
    }
    if (!row.prefs.dailyDigest || clock.minute >= 50) {
      if (row.has_pending_work) {
        const invalid = await env.DB.prepare("SELECT count(*) AS count FROM (SELECT rowid FROM delivery WHERE device_id=? AND state IN ('pending','retry') AND created_at>? AND NOT json_valid(event_payload) LIMIT 60)").bind(row.id, now.getTime() - 50 * 36e5).first();
        metrics.invalidPendingPayloads = (metrics.invalidPendingPayloads ?? 0) + invalid.count;
      }
      const claimed = await env.DB.prepare(`WITH eligible AS (
   SELECT rowid,event_key,created_at,CASE WHEN json_valid(event_payload) THEN json_extract(event_payload,'$.showId') END AS show_id FROM delivery
   WHERE device_id=? AND state IN ('pending','retry') AND created_at>?
   AND CASE WHEN json_valid(event_payload) THEN json_extract(event_payload,'$.showId') END IN (SELECT value FROM json_each(?))
   AND (event_key LIKE ? OR (? AND event_key LIKE 'announced:%' AND substr(event_key,-10)>=?))
   ), selected_shows AS (SELECT show_id FROM eligible GROUP BY show_id ORDER BY min(created_at),show_id LIMIT ?)
   UPDATE delivery SET state='claimed' WHERE state IN ('pending','retry')
   AND rowid IN (SELECT rowid FROM eligible WHERE show_id IN (SELECT show_id FROM selected_shows) ORDER BY created_at,event_key LIMIT 60)
   AND EXISTS(SELECT 1 FROM devices WHERE id=? AND auth_hash=? AND subscription=? AND preferences=?) RETURNING event_key,event_payload`).bind(row.id, now.getTime() - 50 * 36e5, JSON.stringify(row.prefs.showIds), `release:%:${target.toISOString().slice(0, 10)}:${row.prefs.timing}`, row.prefs.dateAnnouncements ? 1 : 0, clock.date, row.prefs.dailyDigest ? 30 : 4, row.id, row.auth_hash, row.subscription, row.preferences).all();
      for (const item of claimed.results) {
        try {
          const event = JSON.parse(item.event_payload);
          if (event.key !== item.event_key || !Number.isSafeInteger(event.showId) || typeof event.title !== "string" || typeof event.body !== "string" || typeof event.url !== "string") throw Error("payload");
          fresh.push(event);
        } catch {
          metrics.preSendFailed++;
          failed++;
          await releaseUnsent(env, row, [{ key: item.event_key }], clock);
        }
      }
      fresh.sort((a, b) => a.key.localeCompare(b.key));
    }
    const baselines = row.prefs.showIds.flatMap((id) => {
      const schedule = schedules.get(id);
      return schedule?.coverage === "complete" ? [{ showId: id, nextDate: nextAirDate(schedule, clock.date) }] : [];
    });
    if (baselines.length) await env.DB.prepare("INSERT INTO show_dates(device_id,show_id,next_date,checked_at) SELECT ?,json_extract(value,'$.showId'),json_extract(value,'$.nextDate'),? FROM json_each(?) WHERE EXISTS(SELECT 1 FROM devices WHERE id=? AND auth_hash=? AND subscription=? AND preferences=?) ON CONFLICT(device_id,show_id) DO UPDATE SET next_date=excluded.next_date,checked_at=excluded.checked_at").bind(row.id, now.getTime(), JSON.stringify(baselines), row.id, row.auth_hash, row.subscription, row.preferences).run();
    if (!fresh.length) continue;
    if (row.prefs.dailyDigest) {
      const digest = await env.DB.prepare("INSERT OR IGNORE INTO delivery(device_id,event_key,state,event_payload,created_at) SELECT ?,?,'claimed','{}',? WHERE EXISTS(SELECT 1 FROM devices WHERE id=? AND auth_hash=? AND subscription=? AND preferences=?)").bind(row.id, `digest:${clock.date}`, now.getTime(), row.id, row.auth_hash, row.subscription, row.preferences).run();
      if (!digest.meta.changes) {
        const retryDigest = await env.DB.prepare("UPDATE delivery SET state='claimed' WHERE device_id=? AND event_key=? AND state='retry'").bind(row.id, `digest:${clock.date}`).run();
        if (!retryDigest.meta.changes) continue;
      }
    }
    const messages = row.prefs.dailyDigest ? [{ events: fresh, payload: { key: `digest:${clock.date}`, title: fresh.length === 1 ? fresh[0].title : "Your next releases", body: fresh.length === 1 ? fresh[0].body : `${fresh.slice(0, 3).map((e) => e.title.slice(0, 100)).join(", ")}${fresh.length > 3 ? ` and ${fresh.length - 3} more releases` : ""}`, url: fresh.length === 1 ? fresh[0].url : "/" } }] : individualMessages(fresh);
    for (const message of messages) {
      let dispatchStarted = false;
      if (Date.now() >= deadline) {
        metrics.deadlineReached = true;
        await releaseUnsent(env, row, message.events, clock);
        continue;
      }
      try {
        const subscription = JSON.parse(row.subscription);
        if (!await validSubscriptionCrypto(subscription)) throw Error("subscription");
        const payload = await buildPushPayload({ data: JSON.stringify(message.payload), options: { ttl: 86400 } }, subscription, { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY });
        if (!await stillCurrent()) {
          await releaseUnsent(env, row, messages.slice(messages.indexOf(message)).flatMap((item) => item.events), clock);
          break;
        }
        if (Date.now() >= deadline) {
          metrics.deadlineReached = true;
          await releaseUnsent(env, row, message.events, clock);
          continue;
        }
        dispatchStarted = true;
        metrics.dispatchAttempts++;
        let response = await fetch(subscription.endpoint, { ...payload, redirect: "error", signal: AbortSignal.timeout(1e4) });
        if (row.prefs.dailyDigest && (response.status === 429 || response.status >= 500) && await stillCurrent() && Date.now() < deadline) {
          metrics.dispatchAttempts++;
          response = await fetch(subscription.endpoint, { ...payload, redirect: "error", signal: AbortSignal.timeout(1e4) });
        }
        if (response.status === 404 || response.status === 410) {
          const removed = await env.DB.prepare("DELETE FROM devices WHERE id=? AND auth_hash=? AND subscription=? AND preferences=? AND updated_at=?").bind(row.id, row.auth_hash, row.subscription, row.preferences, row.updated_at).run();
          if (!removed.meta.changes) await releaseUnsent(env, row, messages.slice(messages.indexOf(message)).flatMap((item) => item.events), clock);
          failed++;
          break;
        }
        const state = response.ok ? "sent" : "retry";
        await env.DB.prepare("UPDATE delivery SET state=? WHERE device_id=? AND event_key IN (SELECT value FROM json_each(?))").bind(state, row.id, JSON.stringify(message.events.map((event) => event.key))).run();
        if (row.prefs.dailyDigest) await env.DB.prepare("UPDATE delivery SET state=? WHERE device_id=? AND event_key=?").bind(state, row.id, `digest:${clock.date}`).run();
        if (response.ok) sent++;
        else failed++;
      } catch {
        failed++;
        if (dispatchStarted) metrics.ambiguousDispatchFailed++;
        else {
          metrics.preSendFailed++;
          await releaseUnsent(env, row, message.events, clock);
        }
      }
    }
  }
  try {
    await cleanup(env, now.getTime(), cursor, metrics);
  } catch {
    metrics.cleanupFailed = true;
    console.log(JSON.stringify({ route: "notification-maintenance", failurePhase: "cleanup" }));
  }
  metrics.sentMessages = sent;
  metrics.failedMessages = failed;
  metrics.durationMs = Date.now() - started;
  metrics.deadlineReached ||= Date.now() >= deadline;
  console.log(JSON.stringify(metrics));
  return metrics;
}
__name(runScheduled, "runScheduled");
var worker_default = { async fetch(request, env) {
  try {
    return await handleRequest(request, env);
  } catch {
    console.log(JSON.stringify({ route: "notification-request", failurePhase: "request" }));
    return json({ error: "Notifications are temporarily unavailable" }, 503);
  }
}, async scheduled(event, env, ctx) {
  ctx.waitUntil(runScheduled(env).catch(() => console.log(JSON.stringify({ route: "notification-delivery", failurePhase: "scheduled" }))));
} };
export {
  worker_default as default,
  handleRequest,
  notificationCapacity,
  runScheduled,
  subscriptionFingerprint
};
