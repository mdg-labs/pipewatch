import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  refreshTokens,
  users,
  workspaceInvites,
  workspaceMembers,
  workspaces,
} from "../schema/index.js";

describe("auth and workspace schema", () => {
  it("exports all five tables with PRD column names", () => {
    expect(getTableName(users)).toBe("users");
    expect(getTableName(refreshTokens)).toBe("refresh_tokens");
    expect(getTableName(workspaces)).toBe("workspaces");
    expect(getTableName(workspaceMembers)).toBe("workspace_members");
    expect(getTableName(workspaceInvites)).toBe("workspace_invites");

    const userColumns = getTableColumns(users);
    expect(userColumns.githubId.isUnique).toBe(true);
    expect(userColumns.name).toBeDefined();

    const workspaceColumns = getTableColumns(workspaces);
    expect(workspaceColumns.slug.isUnique).toBe(true);
    expect(workspaceColumns.plan).toBeDefined();
    expect(workspaceColumns.stripeCustomerId).toBeDefined();
    expect(workspaceColumns.stripeSubscriptionId).toBeDefined();
    expect(workspaceColumns.defaultRetentionDays).toBeDefined();

    const refreshColumns = getTableColumns(refreshTokens);
    expect(refreshColumns.tokenHash.isUnique).toBe(true);

    const inviteColumns = getTableColumns(workspaceInvites);
    expect(inviteColumns.token.isUnique).toBe(true);
  });

  it("defines workspace delete cascade on member and invite FKs", () => {
    const memberFks = getTableConfig(workspaceMembers).foreignKeys;
    const memberWorkspaceFk = memberFks.find((fk) =>
      fk.reference().columns.includes(workspaceMembers.workspaceId),
    );
    expect(memberWorkspaceFk?.onDelete).toBe("cascade");

    const inviteFks = getTableConfig(workspaceInvites).foreignKeys;
    const inviteWorkspaceFk = inviteFks.find((fk) =>
      fk.reference().columns.includes(workspaceInvites.workspaceId),
    );
    expect(inviteWorkspaceFk?.onDelete).toBe("cascade");
  });
});
