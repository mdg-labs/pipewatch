import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

/** Hash a plaintext password with bcrypt (Admin PRD §7.2). */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/** Verify a plaintext password against a bcrypt hash. */
export async function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plain, passwordHash);
}
