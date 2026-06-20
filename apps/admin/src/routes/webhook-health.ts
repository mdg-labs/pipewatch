import type { AdminEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";
import { webhookDeliveries } from "@pipewatch/db-admin/schema";
import { gte, max } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { requireRole } from "../middleware/require-role.js";
import { isNonSuccessStatusCode } from "../services/alerts/webhook-health.js";
import type { AdminAppBindings } from "../types.js";

const SummaryQuerySchema = z.object({
  window_minutes: z.coerce.number().int().min(1).max(24 * 60).optional(),
});

export type WebhookHealthOverall = {
  total: number;
  successCount: number;
  failureCount: number;
  unreachableCount: number;
  failureRate: number;
};

export type WebhookHealthInstallation = WebhookHealthOverall & {
  externalInstallationId: string;
  workspaceId: string | null;
};

export type WebhookHealthSummary = {
  windowMinutes: number;
  overall: WebhookHealthOverall;
  installations: WebhookHealthInstallation[];
};

export type WebhookPollCoverage = {
  latestDeliveredAt: string | null;
  latestPolledAt: string | null;
  pollLagSeconds: number | null;
};

function windowStart(now: Date, windowMinutes: number): Date {
  return new Date(now.getTime() - windowMinutes * 60 * 1000);
}

function toHealthStats(
  total: number,
  failureCount: number,
  unreachableCount: number,
): WebhookHealthOverall {
  const successCount = total - failureCount;

  return {
    total,
    successCount,
    failureCount,
    unreachableCount,
    failureRate: total === 0 ? 0 : failureCount / total,
  };
}

async function getWebhookHealthSummary(
  database: Db,
  env: AdminEnv,
  windowMinutes: number,
  now = new Date(),
): Promise<WebhookHealthSummary> {
  const since = windowStart(now, windowMinutes);

  const rows = await database
    .select({
      statusCode: webhookDeliveries.statusCode,
      externalInstallationId: webhookDeliveries.externalInstallationId,
      workspaceId: webhookDeliveries.workspaceId,
    })
    .from(webhookDeliveries)
    .where(gte(webhookDeliveries.deliveredAt, since));

  let overallFailureCount = 0;
  let overallUnreachableCount = 0;

  const installationStats = new Map<
    string,
    { total: number; failureCount: number; unreachableCount: number; workspaceId: string | null }
  >();

  for (const row of rows) {
    const isFailure = isNonSuccessStatusCode(row.statusCode);
    const isUnreachable = row.statusCode === 0;

    if (isFailure) {
      overallFailureCount += 1;
    }

    if (isUnreachable) {
      overallUnreachableCount += 1;
    }

    if (row.externalInstallationId === null) {
      continue;
    }

    const current = installationStats.get(row.externalInstallationId) ?? {
      total: 0,
      failureCount: 0,
      unreachableCount: 0,
      workspaceId: row.workspaceId,
    };

    current.total += 1;
    if (isFailure) {
      current.failureCount += 1;
    }
    if (isUnreachable) {
      current.unreachableCount += 1;
    }
    if (current.workspaceId === null && row.workspaceId !== null) {
      current.workspaceId = row.workspaceId;
    }

    installationStats.set(row.externalInstallationId, current);
  }

  const installations = [...installationStats.entries()]
    .map(([externalInstallationId, stats]) => ({
      externalInstallationId,
      workspaceId: stats.workspaceId,
      ...toHealthStats(stats.total, stats.failureCount, stats.unreachableCount),
    }))
    .sort((left, right) => right.failureRate - left.failureRate);

  return {
    windowMinutes,
    overall: toHealthStats(
      rows.length,
      overallFailureCount,
      overallUnreachableCount,
    ),
    installations,
  };
}

async function getWebhookPollCoverage(database: Db): Promise<WebhookPollCoverage> {
  const [row] = await database
    .select({
      latestDeliveredAt: max(webhookDeliveries.deliveredAt),
      latestPolledAt: max(webhookDeliveries.polledAt),
    })
    .from(webhookDeliveries);

  const latestDeliveredAt = row?.latestDeliveredAt ?? null;
  const latestPolledAt = row?.latestPolledAt ?? null;

  let pollLagSeconds: number | null = null;
  if (latestDeliveredAt && latestPolledAt) {
    pollLagSeconds = Math.max(
      0,
      Math.round((latestPolledAt.getTime() - latestDeliveredAt.getTime()) / 1000),
    );
  }

  return {
    latestDeliveredAt: latestDeliveredAt?.toISOString() ?? null,
    latestPolledAt: latestPolledAt?.toISOString() ?? null,
    pollLagSeconds,
  };
}

/** Webhook health summary and poll coverage routes (Admin PRD §9.1–9.2). */
export function registerWebhookHealthRoutes(api: Hono<AdminAppBindings>): void {
  const health = new Hono<AdminAppBindings>();

  health.use("*", requireRole("viewer"));

  health.get("/summary", async (c) => {
    const query = SummaryQuerySchema.parse(c.req.query());
    const windowMinutes = query.window_minutes ?? c.get("env").ADMIN_ALERT_WINDOW_MINUTES;
    const summary = await getWebhookHealthSummary(c.get("db"), c.get("env"), windowMinutes);
    return c.json(summary, 200);
  });

  health.get("/coverage", async (c) => {
    const coverage = await getWebhookPollCoverage(c.get("db"));
    return c.json(coverage, 200);
  });

  api.route("/webhook-health", health);
}
