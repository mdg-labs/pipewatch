import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  adminInvites,
  adminPasswordResetTokens,
  adminSessions,
  adminUsers,
  auditEvents,
  webhookDeliveries,
} from "../schema/index.js";
import {
  publicIntegrations,
  publicWorkspaces,
} from "../schema/public-read.js";

describe("admin schema exports", () => {
  it("exports all six admin tables with PRD column names", () => {
    expect(getTableName(webhookDeliveries)).toBe("webhook_deliveries");
    expect(getTableName(adminUsers)).toBe("admin_users");
    expect(getTableName(adminSessions)).toBe("admin_sessions");
    expect(getTableName(adminInvites)).toBe("admin_invites");
    expect(getTableName(adminPasswordResetTokens)).toBe("admin_password_reset_tokens");
    expect(getTableName(auditEvents)).toBe("audit_events");

    const deliveryColumns = getTableColumns(webhookDeliveries);
    expect(deliveryColumns.githubDeliveryId).toBeDefined();
    expect(deliveryColumns.githubGuid).toBeDefined();
    expect(deliveryColumns.externalInstallationId).toBeDefined();
    expect(deliveryColumns.integrationId).toBeDefined();
    expect(deliveryColumns.workspaceId).toBeDefined();
    expect(deliveryColumns.statusCode).toBeDefined();
    expect(deliveryColumns.redelivery).toBeDefined();
    expect(deliveryColumns.deliveredAt).toBeDefined();
    expect(deliveryColumns.polledAt).toBeDefined();

    const userColumns = getTableColumns(adminUsers);
    expect(userColumns.email.isUnique).toBe(true);
    expect(userColumns.passwordHash).toBeDefined();
    expect(userColumns.role).toBeDefined();

    const sessionColumns = getTableColumns(adminSessions);
    expect(sessionColumns.tokenHash.isUnique).toBe(true);

    const inviteColumns = getTableColumns(adminInvites);
    expect(inviteColumns.tokenHash.isUnique).toBe(true);

    const resetColumns = getTableColumns(adminPasswordResetTokens);
    expect(resetColumns.tokenHash.isUnique).toBe(true);
    expect(resetColumns.usedAt).toBeDefined();

    const auditColumns = getTableColumns(auditEvents);
    expect(auditColumns.metadata).toBeDefined();
  });

  it("defines webhook_deliveries indexes including partial failure index", () => {
    const tableConfig = getTableConfig(webhookDeliveries);
    const indexes = tableConfig.indexes;
    const indexNames = indexes.map((entry) => entry.config.name);

    expect(
      tableConfig.uniqueConstraints.some(
        (entry) => entry.name === "webhook_deliveries_github_delivery_id_unique",
      ),
    ).toBe(true);
    expect(indexNames).toContain("webhook_deliveries_workspace_id_delivered_at_idx");
    expect(indexNames).toContain(
      "webhook_deliveries_external_installation_id_delivered_at_idx",
    );
    expect(indexNames).toContain("webhook_deliveries_delivered_at_idx");
    expect(indexNames).toContain("webhook_deliveries_failures_idx");

    const failuresIndex = indexes.find(
      (entry) => entry.config.name === "webhook_deliveries_failures_idx",
    );
    expect(failuresIndex?.config.where).toBeDefined();
  });

  it("defines admin_sessions cascade on admin_user delete", () => {
    const sessionFks = getTableConfig(adminSessions).foreignKeys;
    const adminUserFk = sessionFks.find((fk) =>
      fk.reference().columns.includes(adminSessions.adminUserId),
    );
    expect(adminUserFk?.onDelete).toBe("cascade");
  });

  it("defines admin_password_reset_tokens cascade on admin_user delete", () => {
    const resetFks = getTableConfig(adminPasswordResetTokens).foreignKeys;
    const adminUserFk = resetFks.find((fk) =>
      fk.reference().columns.includes(adminPasswordResetTokens.adminUserId),
    );
    expect(adminUserFk?.onDelete).toBe("cascade");
  });
});

describe("public-read cross-schema helpers", () => {
  it("re-exports public integrations and workspaces from @pipewatch/db", () => {
    expect(getTableName(publicIntegrations)).toBe("integrations");
    expect(getTableName(publicWorkspaces)).toBe("workspaces");
  });
});
