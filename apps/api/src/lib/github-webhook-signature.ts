import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PREFIX = "sha256=";

/** Compute the GitHub `X-Hub-Signature-256` value for a raw payload (test helper). */
export function signGitHubWebhookPayload(payload: string, secret: string): string {
  const digest = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return `${SIGNATURE_PREFIX}${digest}`;
}

/**
 * Verify GitHub webhook HMAC-SHA256 signature (PRD §12.6, Decision #4).
 * Uses constant-time comparison — returns false when lengths differ.
 */
export function verifyGitHubWebhookSignature(
  payload: string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader?.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }

  const providedHex = signatureHeader.slice(SIGNATURE_PREFIX.length);
  const expectedHex = createHmac("sha256", secret).update(payload, "utf8").digest("hex");

  const providedBuf = Buffer.from(providedHex, "utf8");
  const expectedBuf = Buffer.from(expectedHex, "utf8");

  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }

  return timingSafeEqual(providedBuf, expectedBuf);
}
