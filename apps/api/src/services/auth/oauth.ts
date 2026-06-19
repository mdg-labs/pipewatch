import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { flags } from "@pipewatch/config/edition";
import type { ApiEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";
import {
  users,
  workspaceMembers,
  workspaces,
} from "@pipewatch/db/schema";
import type { GitHubUserProfile, OAuthStatePayload } from "@pipewatch/types";
import { count, desc, eq, sql } from "drizzle-orm";

export const OAUTH_STATE_COOKIE_NAME = "pw_oauth_state";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export type GitHubOAuthClient = {
  exchangeCode: (code: string, redirectUri: string) => Promise<GitHubUserProfile>;
};

type WorkspaceRow = typeof workspaces.$inferSelect;

export type UpsertUserResult = {
  user: typeof users.$inferSelect;
  isNew: boolean;
  wasFirstUser: boolean;
  bootstrapWorkspace: WorkspaceRow | null;
};

const CE_BOOTSTRAP_ADVISORY_LOCK_KEY = "pipewatch_ce_bootstrap";

export type AuthSessionContext = {
  user: typeof users.$inferSelect;
  workspace: WorkspaceRow | null;
  membershipRole: "owner" | "admin" | "member" | null;
};

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("base64url");
}

/** Create signed OAuth state for CSRF protection (PRD §20). */
export function createOAuthState(
  secret: string,
  next?: string,
): { state: string; cookieValue: string } {
  const payload: OAuthStatePayload = {
    nonce: randomBytes(32).toString("hex"),
    ...(next !== undefined ? { next } : {}),
    exp: Date.now() + OAUTH_STATE_TTL_MS,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encoded, secret);

  return {
    state: payload.nonce,
    cookieValue: `${encoded}.${signature}`,
  };
}

/** Validate callback state against the signed cookie. */
export function verifyOAuthState(
  secret: string,
  stateParam: string,
  cookieValue: string | undefined,
): OAuthStatePayload {
  if (!cookieValue) {
    throw new OAuthError("Missing OAuth state cookie", 401);
  }

  const [encoded, signature] = cookieValue.split(".");
  if (!encoded || !signature) {
    throw new OAuthError("Invalid OAuth state cookie", 401);
  }

  const expectedSignature = signPayload(encoded, secret);
  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new OAuthError("Invalid OAuth state signature", 401);
  }

  const payload = JSON.parse(base64UrlDecode(encoded)) as OAuthStatePayload;

  if (payload.nonce !== stateParam) {
    throw new OAuthError("OAuth state mismatch", 401);
  }

  if (payload.exp < Date.now()) {
    throw new OAuthError("OAuth state expired", 401);
  }

  return payload;
}

/** Build the GitHub authorize URL for browser OAuth. */
export function buildGitHubAuthorizeUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user user:email",
    state,
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/** Default GitHub OAuth client using the GitHub REST API. */
export function createGitHubOAuthClient(config: {
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
}): GitHubOAuthClient {
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    async exchangeCode(code, redirectUri) {
      const tokenResponse = await fetchImpl(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            redirect_uri: redirectUri,
          }),
        },
      );

      if (!tokenResponse.ok) {
        throw new OAuthError("GitHub token exchange failed", 502);
      }

      const tokenBody = (await tokenResponse.json()) as {
        access_token?: string;
        error?: string;
      };

      if (!tokenBody.access_token) {
        throw new OAuthError(tokenBody.error ?? "GitHub token exchange failed", 502);
      }

      const userResponse = await fetchImpl("https://api.github.com/user", {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${tokenBody.access_token}`,
          "User-Agent": "pipewatch-api",
        },
      });

      if (!userResponse.ok) {
        throw new OAuthError("GitHub user lookup failed", 502);
      }

      const userBody = (await userResponse.json()) as {
        id: number;
        login: string;
        email: string | null;
        name: string | null;
        avatar_url: string | null;
      };

      return {
        githubId: BigInt(userBody.id),
        githubLogin: userBody.login,
        email: userBody.email,
        name: userBody.name,
        avatarUrl: userBody.avatar_url,
      };
    },
  };
}

/** Count users before upsert to detect CE first-run bootstrap. */
export async function countUsers(database: Db): Promise<number> {
  const [result] = await database.select({ value: count() }).from(users);
  return result?.value ?? 0;
}

/**
 * Upsert a GitHub user by `github_id` (PRD §20).
 * CE first-user bootstrap runs in the same transaction under an advisory lock so only
 * one concurrent OAuth callback can receive the admin workspace grant.
 */
export async function upsertGitHubUser(
  database: Db,
  profile: GitHubUserProfile,
): Promise<UpsertUserResult> {
  return database.transaction(async (tx) => {
    if (flags.BOOTSTRAP_ENABLED) {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${CE_BOOTSTRAP_ADVISORY_LOCK_KEY}))`,
      );
    }

    const existing = await tx
      .select()
      .from(users)
      .where(eq(users.githubId, profile.githubId))
      .limit(1);

    if (existing[0]) {
      const [updated] = await tx
        .update(users)
        .set({
          githubLogin: profile.githubLogin,
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing[0].id))
        .returning();

      if (!updated) {
        throw new Error("Failed to update GitHub user");
      }

      return {
        user: updated,
        isNew: false,
        wasFirstUser: false,
        bootstrapWorkspace: null,
      };
    }

    let wasFirstUser = false;
    if (flags.BOOTSTRAP_ENABLED) {
      const [userCount] = await tx.select({ value: count() }).from(users);
      wasFirstUser = (userCount?.value ?? 0) === 0;
    }

    const [created] = await tx
      .insert(users)
      .values({
        githubId: profile.githubId,
        githubLogin: profile.githubLogin,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create GitHub user");
    }

    const bootstrapWorkspace = wasFirstUser
      ? await bootstrapCeWorkspace(tx, created.id)
      : null;

    return { user: created, isNew: true, wasFirstUser, bootstrapWorkspace };
  });
}

/** CE bootstrap — default workspace for the first user (PRD §26, pages B0). */
export async function bootstrapCeWorkspace(
  database: Db,
  userId: string,
): Promise<WorkspaceRow | null> {
  if (!flags.BOOTSTRAP_ENABLED) {
    return null;
  }

  const [workspace] = await database
    .insert(workspaces)
    .values({
      name: "My Workspace",
      slug: "my-workspace",
      plan: "free",
    })
    .returning();

  if (!workspace) {
    throw new Error("Failed to create bootstrap workspace");
  }

  await database.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId,
    role: "owner",
    acceptedAt: new Date(),
  });

  return workspace;
}

/** Load workspace memberships ordered by most recent activity. */
export async function listUserWorkspaces(
  database: Db,
  userId: string,
): Promise<Array<{ workspace: WorkspaceRow; role: string }>> {
  const rows = await database
    .select({
      workspace: workspaces,
      role: workspaceMembers.role,
      invitedAt: workspaceMembers.invitedAt,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(desc(workspaceMembers.invitedAt));

  return rows.map((row) => ({
    workspace: row.workspace,
    role: row.role,
  }));
}

/** Resolve active workspace + role for JWT issuance. */
export async function resolveAuthSession(
  database: Db,
  userId: string,
  bootstrapWorkspace: WorkspaceRow | null,
): Promise<AuthSessionContext> {
  if (bootstrapWorkspace) {
    const [user] = await database.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      throw new Error("User not found after OAuth");
    }

    return {
      user,
      workspace: bootstrapWorkspace,
      membershipRole: "owner",
    };
  }

  const memberships = await listUserWorkspaces(database, userId);
  const primary = memberships[0];

  const [user] = await database.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw new Error("User not found after OAuth");
  }

  if (!primary) {
    return { user, workspace: null, membershipRole: null };
  }

  const role =
    primary.role === "owner" || primary.role === "admin" || primary.role === "member"
      ? primary.role
      : "member";

  return {
    user,
    workspace: primary.workspace,
    membershipRole: role,
  };
}

function isSafeNextPath(next: string): boolean {
  return next.startsWith("/") && !next.startsWith("//");
}

function joinAppUrl(appUrl: string, path: string): string {
  return `${appUrl.replace(/\/$/, "")}${path}`;
}

/** Post-auth browser redirect (pages B1, B15–B16). */
export function resolvePostAuthRedirect(input: {
  appUrl: string;
  next?: string;
  wasFirstUser: boolean;
  bootstrapWorkspace: WorkspaceRow | null;
  memberships: Array<{ workspace: WorkspaceRow; role: string }>;
}): string {
  if (input.next && isSafeNextPath(input.next)) {
    return joinAppUrl(input.appUrl, input.next);
  }

  if (input.wasFirstUser && flags.BOOTSTRAP_ENABLED && input.bootstrapWorkspace) {
    return joinAppUrl(input.appUrl, "/onboarding?step=2");
  }

  if (input.memberships.length === 0) {
    return joinAppUrl(input.appUrl, "/onboarding?step=1");
  }

  return joinAppUrl(input.appUrl, `/workspaces/${input.memberships[0]!.workspace.slug}/`);
}

export function requireOAuthConfig(env: ApiEnv): {
  clientId: string;
  clientSecret: string;
  jwtSecret: string;
  refreshSecret: string;
  appUrl: string;
} {
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  const jwtSecret = env.JWT_SECRET;
  const refreshSecret = env.JWT_REFRESH_SECRET;
  const appUrl = env.APP_URL;

  if (!clientId || !clientSecret || !jwtSecret || !refreshSecret || !appUrl) {
    throw new OAuthError("OAuth is not configured", 503);
  }

  return { clientId, clientSecret, jwtSecret, refreshSecret, appUrl };
}

export class OAuthError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "OAuthError";
    this.status = status;
  }
}
