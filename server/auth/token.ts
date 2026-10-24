import { SignJWT, jwtVerify } from "jose";

// Edge-safe (used by proxy.ts too): no Node-only imports here.
export const SESSION_COOKIE = "cqr_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

// Without AUTH_SECRET the app still runs (demo accounts only) using a fixed
// development secret; the integrations page flags this as not production-ready.
const DEV_SECRET = "coffee-on-qr-insecure-demo-secret-set-AUTH_SECRET";

function key() {
  return new TextEncoder().encode(process.env.AUTH_SECRET || DEV_SECRET);
}

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key());
}

export async function verifySession(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
