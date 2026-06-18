"use client";

import type { WorkspaceListItem, WorkspaceRole } from "@pipewatch/types";
import { createContext, useContext } from "react";

import { useApi } from "@/hooks/use-api";

const ROLE_RANK: Record<WorkspaceRole, number> = {
  member: 1,
  admin: 2,
  owner: 3,
};

/** True when `role` meets or exceeds `minimumRole` (PRD §5). */
export function roleMeetsMinimum(
  role: WorkspaceRole,
  minimumRole: "admin" | "owner",
): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimumRole];
}

export type WorkspaceRoleContextValue = {
  readOnly: boolean;
};

export const WorkspaceRoleContext = createContext<WorkspaceRoleContextValue | null>(
  null,
);

function resolveRoleFromWorkspaces(
  workspaceSlug: string | null,
  workspaces: readonly WorkspaceListItem[],
): WorkspaceRole | null {
  if (!workspaceSlug) {
    return null;
  }

  return workspaces.find((workspace) => workspace.slug === workspaceSlug)?.role ?? null;
}

export type WorkspaceRoleState = {
  role: WorkspaceRole | null;
  readOnly: boolean;
  canMutate: boolean;
  canManageBilling: boolean;
  meetsMinimum: (minimumRole: "admin" | "owner") => boolean;
};

/** Active workspace role from JWT claims with workspace-list fallback. */
export function useWorkspaceRole(): WorkspaceRoleState {
  const { claims, workspaces, workspaceSlug } = useApi();
  const override = useContext(WorkspaceRoleContext);

  const role = claims?.role ?? resolveRoleFromWorkspaces(workspaceSlug, workspaces);
  const readOnly = override?.readOnly ?? (role !== null && !roleMeetsMinimum(role, "admin"));

  return {
    role,
    readOnly,
    canMutate: role !== null && roleMeetsMinimum(role, "admin") && !readOnly,
    canManageBilling: role === "owner",
    meetsMinimum: (minimumRole) =>
      role !== null && roleMeetsMinimum(role, minimumRole),
  };
}
