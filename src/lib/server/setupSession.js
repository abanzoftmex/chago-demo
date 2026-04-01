import crypto from "crypto";

const COOKIE_NAME = "tenant_setup_session";
const SESSION_DURATION_MS = 10 * 60 * 1000;

const toBase64Url = (value) => Buffer.from(value).toString("base64url");
const fromBase64Url = (value) => Buffer.from(value, "base64url").toString("utf8");

const signPayload = (payload, secret) =>
  crypto.createHmac("sha256", secret).update(payload).digest("base64url");

export const createSetupSessionCookie = (secret) => {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const payload = toBase64Url(JSON.stringify({ expiresAt }));
  const signature = signPayload(payload, secret);
  const value = `${payload}.${signature}`;

  return `${COOKIE_NAME}=${value}; Max-Age=600; Path=/; HttpOnly; SameSite=Strict`;
};

export const clearSetupSessionCookie = () =>
  `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict`;

export const parseCookies = (cookieHeader = "") =>
  cookieHeader.split(";").reduce((acc, pair) => {
    const [rawName, ...rawValue] = pair.trim().split("=");
    if (!rawName) return acc;
    acc[rawName] = rawValue.join("=");
    return acc;
  }, {});

export const verifySetupSessionCookie = (cookieHeader, secret) => {
  if (!secret) return false;

  const cookies = parseCookies(cookieHeader);
  const sessionValue = cookies[COOKIE_NAME];

  if (!sessionValue) return false;

  const [payload, providedSignature] = sessionValue.split(".");
  if (!payload || !providedSignature) return false;

  const expectedSignature = signPayload(payload, secret);

  if (providedSignature !== expectedSignature) {
    return false;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(payload));
    return typeof parsed.expiresAt === "number" && parsed.expiresAt > Date.now();
  } catch {
    return false;
  }
};

export const setupSessionDurationMs = SESSION_DURATION_MS;
