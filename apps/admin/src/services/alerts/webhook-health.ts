import type { AdminEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";
import { webhookDeliveries } from "@pipewatch/db-admin/schema";
import * as Sentry from "@sentry/node";
import { gte } from "drizzle-orm";

export type DeliveryWindowRow = {
  statusCode: number;
  externalInstallationId: string | null;
};

export type DeliveryWindowStats = {
  total: number;
  nonSuccessCount: number;
  unreachableCount: number;
};

export type UnreachableSpike = {
  scope: "global" | "installation";
  externalInstallationId: string | null;
  count: number;
};

export type WebhookHealthAlertDeps = {
  env: AdminEnv;
  db: Db;
  now?: Date;
  rateLimiter?: AlertRateLimiter;
};

function windowStart(now: Date, windowMinutes: number): Date {
  return new Date(now.getTime() - windowMinutes * 60 * 1000);
}

/** True when status is outside the 2xx success band (Admin PRD §9.2). */
export function isNonSuccessStatusCode(statusCode: number): boolean {
  return statusCode < 200 || statusCode > 299;
}

/** Aggregate delivery outcomes for a rolling alert window. */
export function summarizeDeliveryWindow(
  rows: DeliveryWindowRow[],
): DeliveryWindowStats {
  let nonSuccessCount = 0;
  let unreachableCount = 0;

  for (const row of rows) {
    if (row.statusCode === 0) {
      unreachableCount += 1;
    }
    if (isNonSuccessStatusCode(row.statusCode)) {
      nonSuccessCount += 1;
    }
  }

  return {
    total: rows.length,
    nonSuccessCount,
    unreachableCount,
  };
}

/** Evaluate whether the global non-2xx rate exceeds the configured threshold. */
export function isElevatedFailureRate(
  stats: DeliveryWindowStats,
  threshold: number,
): boolean {
  if (stats.total === 0) {
    return false;
  }

  return stats.nonSuccessCount / stats.total > threshold;
}

/** Evaluate whether unreachable deliveries meet or exceed the spike threshold. */
export function isUnreachableSpike(count: number, threshold: number): boolean {
  return count >= threshold;
}

/** Detect global and per-installation unreachable spikes in the window. */
export function findUnreachableSpikes(
  rows: DeliveryWindowRow[],
  threshold: number,
): UnreachableSpike[] {
  const stats = summarizeDeliveryWindow(rows);

  if (isUnreachableSpike(stats.unreachableCount, threshold)) {
    return [
      {
        scope: "global",
        externalInstallationId: null,
        count: stats.unreachableCount,
      },
    ];
  }

  const perInstallation = new Map<string, number>();
  for (const row of rows) {
    if (row.statusCode !== 0 || row.externalInstallationId === null) {
      continue;
    }

    const current = perInstallation.get(row.externalInstallationId) ?? 0;
    perInstallation.set(row.externalInstallationId, current + 1);
  }

  const spikes: UnreachableSpike[] = [];
  for (const [externalInstallationId, count] of perInstallation) {
    if (!isUnreachableSpike(count, threshold)) {
      continue;
    }

    spikes.push({
      scope: "installation",
      externalInstallationId,
      count,
    });
  }

  return spikes;
}

/** In-memory alert dedup — suppress repeated Sentry noise within the cooldown window. */
export class AlertRateLimiter {
  private readonly lastSent = new Map<string, number>();

  shouldSend(fingerprint: string, cooldownMs: number, now = Date.now()): boolean {
    const last = this.lastSent.get(fingerprint);
    if (last !== undefined && now - last < cooldownMs) {
      return false;
    }

    this.lastSent.set(fingerprint, now);
    return true;
  }
}

function alertCooldownMs(windowMinutes: number): number {
  return windowMinutes * 60 * 1000;
}

function captureFailureRateAlert(
  stats: DeliveryWindowStats,
  threshold: number,
  windowMinutes: number,
): void {
  const failureRate = stats.nonSuccessCount / stats.total;

  Sentry.captureMessage("Admin webhook delivery failure rate elevated", {
    level: "warning",
    tags: {
      alert: "webhook_failure_rate",
      scope: "global",
    },
    extra: {
      total: stats.total,
      nonSuccessCount: stats.nonSuccessCount,
      failureRate,
      threshold,
      windowMinutes,
    },
  });
}

function captureUnreachableAlert(
  spike: UnreachableSpike,
  threshold: number,
  windowMinutes: number,
): void {
  Sentry.captureMessage("Admin webhook delivery unreachable spike", {
    level: "error",
    tags: {
      alert: "webhook_unreachable_spike",
      scope: spike.scope,
      ...(spike.externalInstallationId
        ? { external_installation_id: spike.externalInstallationId }
        : {}),
    },
    extra: {
      count: spike.count,
      threshold,
      windowMinutes,
      externalInstallationId: spike.externalInstallationId,
    },
  });
}

/** Query recent webhook deliveries and emit threshold-based Sentry alerts. */
export async function evaluateWebhookHealthAlerts(
  deps: WebhookHealthAlertDeps,
): Promise<void> {
  const now = deps.now ?? new Date();
  const windowMinutes = deps.env.ADMIN_ALERT_WINDOW_MINUTES;
  const failureThreshold = deps.env.ADMIN_ALERT_FAILURE_RATE_THRESHOLD;
  const unreachableThreshold = deps.env.ADMIN_ALERT_UNREACHABLE_COUNT;
  const rateLimiter = deps.rateLimiter ?? new AlertRateLimiter();
  const cooldownMs = alertCooldownMs(windowMinutes);

  const rows = await deps.db
    .select({
      statusCode: webhookDeliveries.statusCode,
      externalInstallationId: webhookDeliveries.externalInstallationId,
    })
    .from(webhookDeliveries)
    .where(gte(webhookDeliveries.deliveredAt, windowStart(now, windowMinutes)));

  const stats = summarizeDeliveryWindow(rows);

  if (
    isElevatedFailureRate(stats, failureThreshold) &&
    rateLimiter.shouldSend("failure_rate:global", cooldownMs, now.getTime())
  ) {
    captureFailureRateAlert(stats, failureThreshold, windowMinutes);
  }

  const spikes = findUnreachableSpikes(rows, unreachableThreshold);
  for (const spike of spikes) {
    const fingerprint =
      spike.scope === "global"
        ? "unreachable:global"
        : `unreachable:installation:${spike.externalInstallationId ?? "unknown"}`;

    if (!rateLimiter.shouldSend(fingerprint, cooldownMs, now.getTime())) {
      continue;
    }

    captureUnreachableAlert(spike, unreachableThreshold, windowMinutes);
  }
}
