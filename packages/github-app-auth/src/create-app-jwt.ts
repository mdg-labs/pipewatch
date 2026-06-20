import { createPrivateKey, type KeyObject } from "node:crypto";

import { SignJWT } from "jose";

/** GitHub App JWT lifetime — must stay under GitHub's 10-minute maximum (PRD §4.4). */
export const APP_JWT_TTL_SECONDS = 9 * 60;

export class GitHubAppJwtError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "GitHubAppJwtError";
    this.status = status;
    this.code = code;
  }
}

export type GitHubAppJwtConfig = {
  appId: string;
  privateKey: string;
};

/**
 * Normalize PEM private key from env — supports literal newlines, escaped `\\n`, and
 * base64-encoded PEM blobs (Phase stores `GITHUB_APP_PRIVATE_KEY` base64-encoded).
 */
export function normalizePrivateKey(rawKey: string): string {
  const trimmed = rawKey.trim();

  if (trimmed.includes("-----BEGIN")) {
    return trimmed.replace(/\\n/g, "\n");
  }

  const decoded = Buffer.from(trimmed, "base64").toString("utf8").trim();
  if (decoded.includes("-----BEGIN")) {
    return decoded.replace(/\\n/g, "\n");
  }

  throw new GitHubAppJwtError(
    "GITHUB_APP_PRIVATE_KEY is not a valid PEM key",
    500,
    "INVALID_GITHUB_APP_PRIVATE_KEY",
  );
}

/** Import PEM private key — accepts PKCS#1 (`RSA PRIVATE KEY`) and PKCS#8 (`PRIVATE KEY`). */
function importSigningKey(rawKey: string): KeyObject {
  let pem: string;
  try {
    pem = normalizePrivateKey(rawKey);
  } catch (error) {
    if (error instanceof GitHubAppJwtError) {
      throw error;
    }

    throw new GitHubAppJwtError(
      "GITHUB_APP_PRIVATE_KEY is not a valid PEM key",
      500,
      "INVALID_GITHUB_APP_PRIVATE_KEY",
    );
  }

  try {
    return createPrivateKey(pem);
  } catch {
    throw new GitHubAppJwtError(
      "GITHUB_APP_PRIVATE_KEY is not a valid PEM key",
      500,
      "INVALID_GITHUB_APP_PRIVATE_KEY",
    );
  }
}

/** Sign a short-lived RS256 JWT for GitHub App authentication (PRD §4.4). */
export async function createAppJwt(config: GitHubAppJwtConfig): Promise<string> {
  const privateKey = importSigningKey(config.privateKey);

  try {
    return await new SignJWT({})
      .setProtectedHeader({ alg: "RS256" })
      .setIssuedAt()
      .setIssuer(config.appId)
      .setExpirationTime(`${String(APP_JWT_TTL_SECONDS)}s`)
      .sign(privateKey);
  } catch {
    throw new GitHubAppJwtError(
      "Failed to sign GitHub App JWT with private key",
      500,
      "INVALID_GITHUB_APP_PRIVATE_KEY",
    );
  }
}
