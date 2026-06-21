import type { AdminEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";
import { webhookDeliveries } from "@pipewatch/db-admin/schema";
import { desc, gte, max } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { requireRole } from "../middleware/require-role.js";
import { isNonSuccessStatusCode } from "../services/alerts/webhook-health.js";
import type { AdminAppBindings } from "../types.js";

const SummaryQuerySchema = z.object({
  window_minutes: z.coerce.number().int().min(1).max(24 * 60).optional(),
});

const POLL_FRESHNESS_WARN_SECONDS = 180;
const INGEST_LAG_WARN_SECONDS = 300;

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
  lastDeliveryAt: string | null;
  lastPollAt: string | null;
  pollFreshnessSeconds: number | null;
  ingestLagSeconds: number | null;
  pollFreshnessOk: boolean;
  ingestLagOk: boolean;
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

async function getWebhookPollCoverage(
  database: Db,
  now = new Date(),
): Promise<WebhookPollCoverage> {
  const [aggregateRow] = await database
    .select({
      lastDeliveryAt: max(webhookDeliveries.deliveredAt),
      lastPollAt: max(webhookDeliveries.polledAt),
    })
    .from(webhookDeliveries);

  const lastDeliveryAt = aggregateRow?.lastDeliveryAt ?? null;
  const lastPollAt = aggregateRow?.lastPollAt ?? null;

  let pollFreshnessSeconds: number | null = null;
  if (lastPollAt) {
    pollFreshnessSeconds = Math.max(
      0,
      Math.round((now.getTime() - lastPollAt.getTime()) / 1000),
    );
  }

  let ingestLagSeconds: number | null = null;
  if (lastDeliveryAt) {
    const [newestDelivery] = await database
      .select({
        deliveredAt: webhookDeliveries.deliveredAt,
        firstPolledAt: webhookDeliveries.firstPolledAt,
      })
      .from(webhookDeliveries)
      .orderBy(desc(webhookDeliveries.deliveredAt))
      .limit(1);

    if (newestDelivery) {
      ingestLagSeconds = Math.max(
        0,
        Math.round(
          (newestDelivery.firstPolledAt.getTime() -
            newestDelivery.deliveredAt.getTime()) /
            1000,
        ),
      );
    }
  }

  const pollFreshnessOk =
    pollFreshnessSeconds === null ||
    pollFreshnessSeconds <= POLL_FRESHNESS_WARN_SECONDS;
  const ingestLagOk =
    ingestLagSeconds === null || ingestLagSeconds <= INGEST_LAG_WARN_SECONDS;

  return {
    lastDeliveryAt: lastDeliveryAt?.toISOString() ?? null,
    lastPollAt: lastPollAt?.toISOString() ?? null,
    pollFreshnessSeconds,
    ingestLagSeconds,
    pollFreshnessOk,
    ingestLagOk,
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
