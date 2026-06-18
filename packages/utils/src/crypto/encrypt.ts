import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function deriveKey(encryptionKey: string): Buffer {
  return createHash("sha256").update(encryptionKey, "utf8").digest();
}

function resolveEncryptionKey(override?: string): string {
  const key = override ?? process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  return key;
}

/** AES-256-GCM encrypt — key from `ENCRYPTION_KEY` unless overridden. */
export function encrypt(plaintext: string, encryptionKey?: string): string {
  const key = deriveKey(resolveEncryptionKey(encryptionKey));
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/** AES-256-GCM decrypt — key from `ENCRYPTION_KEY` unless overridden. */
export function decrypt(ciphertext: string, encryptionKey?: string): string {
  const key = deriveKey(resolveEncryptionKey(encryptionKey));
  const payload = Buffer.from(ciphertext, "base64");

  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Invalid ciphertext");
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}
