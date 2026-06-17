import { SignJWT, jwtVerify } from "jose";

import type { AccessTokenClaims, WorkspaceRole } from "@pipewatch/types";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export type SignAccessTokenInput = {
  userId: string;
  workspaceId?: string;
  role?: WorkspaceRole;
};

function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/** Issue a short-lived HS256 access JWT (PRD §7.1 — 15 minutes). */
export async function signAccessToken(
  input: SignAccessTokenInput,
  secret: string,
): Promise<string> {
  const jwt = new SignJWT({
    ...(input.workspaceId !== undefined ? { workspaceId: input.workspaceId } : {}),
    ...(input.role !== undefined ? { role: input.role } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime(`${String(ACCESS_TOKEN_TTL_SECONDS)}s`);

  return jwt.sign(encodeSecret(secret));
}

/** Verify and decode an access JWT. */
export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, encodeSecret(secret), {
    algorithms: ["HS256"],
  });

  if (typeof payload.sub !== "string") {
    throw new Error("Invalid access token subject");
  }

  const workspaceId =
    typeof payload.workspaceId === "string" ? payload.workspaceId : undefined;
  const role =
    payload.role === "owner" || payload.role === "admin" || payload.role === "member"
      ? payload.role
      : undefined;

  return {
    sub: payload.sub,
    ...(workspaceId !== undefined ? { workspaceId } : {}),
    ...(role !== undefined ? { role } : {}),
    iat: payload.iat ?? 0,
    exp: payload.exp ?? 0,
  };
}

export { ACCESS_TOKEN_TTL_SECONDS };
