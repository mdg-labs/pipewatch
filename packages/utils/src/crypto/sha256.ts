import { createHash } from "node:crypto";

/** SHA-256 digest of `input`, returned as lowercase hex. */
export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}
