import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "pw_admin_session";

/** Opaque session token before HMAC signing. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Sign an opaque token with `ADMIN_SESSION_SECRET` for the session cookie. */
export function signOpaqueToken(token: string, secret: string): string {
  const signature = createHmac("sha256", secret).update(token, "utf8").digest("base64url");
  return `${token}.${signature}`;
}

/** Verify cookie value and return the opaque token, or null when invalid. */
export function verifySignedOpaqueToken(signed: string, secret: string): string | null {
  const separator = signed.lastIndexOf(".");
  if (separator <= 0) {
    return null;
  }

  const token = signed.slice(0, separator);
  const signature = signed.slice(separator + 1);
  const expected = createHmac("sha256", secret).update(token, "utf8").digest("base64url");

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (sigBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  return token;
}
