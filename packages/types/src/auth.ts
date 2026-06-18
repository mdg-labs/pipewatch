import type { WorkspaceRole } from "./common.js";

/** Claims embedded in a short-lived access JWT (PRD §7.1, §20). */
export type AccessTokenClaims = {
  sub: string;
  workspaceId?: string;
  role?: WorkspaceRole;
  iat: number;
  exp: number;
};

/** GitHub user profile returned after OAuth code exchange. */
export type GitHubUserProfile = {
  githubId: bigint;
  githubLogin: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

/** Signed OAuth state stored in the CSRF cookie during the GitHub redirect. */
export type OAuthStatePayload = {
  nonce: string;
  next?: string;
  exp: number;
};
