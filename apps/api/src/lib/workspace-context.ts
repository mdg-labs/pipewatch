import type { Context } from "hono";
import { and, eq, isNotNull, isNull, or, gt } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import type { Db } from "@pipewatch/db";
import { workspaceMembers } from "@pipewatch/db/schema";
import { sha256 } from "@pipewatch/utils";
import type { WorkspaceRole } from "@pipewatch/types";

import { verifyAccessToken } from "../services/auth/jwt.js";

/** Mirrors `api_keys` for lookup until P4-03 wires full API key auth. */
const apiKeysLookup = pgTable("api_keys", {
  workspaceId: uuid("workspace_id").notNull(),
  createdBy: uuid("created_by").notNull(),
  keyHash: text("key_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const API_KEY_PREFIX = "pw_";

export type AuthMode = "jwt" | "api_key";

/** Resolved workspace identity attached to authenticated workspace-scoped requests. */
export type WorkspaceContext = {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  authMode: AuthMode;
};

export const WORKSPACE_CONTEXT_KEY = "workspaceContext";

const ROLE_RANK: Record<WorkspaceRole, number> = {
  member: 1,
  admin: 2,
  owner: 3,
};

export function roleMeetsMinimum(
  role: WorkspaceRole,
  minimumRole: "admin" | "owner",
): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimumRole];
}

export function getWorkspaceContext(c: Context): WorkspaceContext | undefined {
  return c.get(WORKSPACE_CONTEXT_KEY);
}

export function setWorkspaceContext(c: Context, context: WorkspaceContext): void {
  c.set(WORKSPACE_CONTEXT_KEY, context);
}

export function parseBearerToken(authorizationHeader: string | undefined): string | undefined {
  if (!authorizationHeader) {
    return undefined;
  }

  const match = /^Bearer\s+(\S+)$/i.exec(authorizationHeader);
  return match?.[1];
}

export function isApiKeyToken(token: string): boolean {
  return token.startsWith(API_KEY_PREFIX);
}

export type JwtAuthIdentity = {
  authMode: "jwt";
  userId: string;
  workspaceId?: string;
};

export type ApiKeyAuthIdentity = {
  authMode: "api_key";
  userId: string;
  workspaceId: string;
};

export type AuthIdentity = JwtAuthIdentity | ApiKeyAuthIdentity;

export async function resolveJwtAuthIdentity(
  token: string,
  jwtSecret: string,
): Promise<JwtAuthIdentity | null> {
  try {
    const claims = await verifyAccessToken(token, jwtSecret);
    return {
      authMode: "jwt",
      userId: claims.sub,
      ...(claims.workspaceId !== undefined ? { workspaceId: claims.workspaceId } : {}),
    };
  } catch {
    return null;
  }
}

export async function resolveApiKeyAuthIdentity(
  database: Db,
  rawKey: string,
): Promise<ApiKeyAuthIdentity | null> {
  const keyHash = sha256(rawKey);
  const now = new Date();

  const [row] = await database
    .select({
      workspaceId: apiKeysLookup.workspaceId,
      createdBy: apiKeysLookup.createdBy,
    })
    .from(apiKeysLookup)
    .where(
      and(
        eq(apiKeysLookup.keyHash, keyHash),
        isNull(apiKeysLookup.revokedAt),
        or(isNull(apiKeysLookup.expiresAt), gt(apiKeysLookup.expiresAt, now)),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    authMode: "api_key",
    userId: row.createdBy,
    workspaceId: row.workspaceId,
  };
}

export async function resolveAuthIdentity(
  database: Db,
  authorizationHeader: string | undefined,
  jwtSecret: string,
): Promise<AuthIdentity | null> {
  const token = parseBearerToken(authorizationHeader);
  if (!token) {
    return null;
  }

  if (isApiKeyToken(token)) {
    return resolveApiKeyAuthIdentity(database, token);
  }

  return resolveJwtAuthIdentity(token, jwtSecret);
}

export async function loadWorkspaceMembership(
  database: Db,
  workspaceId: string,
  userId: string,
): Promise<WorkspaceRole | null> {
  const [row] = await database
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
        isNotNull(workspaceMembers.acceptedAt),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  if (row.role === "owner" || row.role === "admin" || row.role === "member") {
    return row.role;
  }

  return null;
}

/** API keys act as admin for workspace-scoped routes (PRD §7.1 programmatic access). */
export const API_KEY_WORKSPACE_ROLE: WorkspaceRole = "admin";

export async function buildWorkspaceContext(
  database: Db,
  identity: AuthIdentity,
  routeWorkspaceId: string,
): Promise<WorkspaceContext | "forbidden"> {
  if (identity.authMode === "api_key") {
    if (identity.workspaceId !== routeWorkspaceId) {
      return "forbidden";
    }

    return {
      workspaceId: routeWorkspaceId,
      userId: identity.userId,
      role: API_KEY_WORKSPACE_ROLE,
      authMode: "api_key",
    };
  }

  if (identity.workspaceId !== undefined && identity.workspaceId !== routeWorkspaceId) {
    return "forbidden";
  }

  const membershipRole = await loadWorkspaceMembership(
    database,
    routeWorkspaceId,
    identity.userId,
  );

  if (!membershipRole) {
    return "forbidden";
  }

  return {
    workspaceId: routeWorkspaceId,
    userId: identity.userId,
    role: membershipRole,
    authMode: "jwt",
  };
}
