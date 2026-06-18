import { createHmac, timingSafeEqual } from "node:crypto";

/** Compute the Postmark `X-Postmark-Signature` value for a raw payload (test helper). */
export function signPostmarkWebhookPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("base64");
}

/**
 * Verify Postmark webhook HMAC-SHA256 signature (base64 over raw body).
 * Uses constant-time comparison — returns false when lengths differ.
 */
export function verifyPostmarkWebhookSignature(
  payload: string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(payload, "utf8").digest("base64");

  const providedBuf = Buffer.from(signatureHeader, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");

  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }

  return timingSafeEqual(providedBuf, expectedBuf);
}
