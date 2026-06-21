import type { AdminEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";
import { auditEvents, webhookDeliveries } from "@pipewatch/db-admin/schema";
import { createAppJwt } from "@pipewatch/github-app-auth";
import {
  and,
  count,
  desc,
  eq,
  gte,
  lte,
  type SQL,
} from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { AdminHttpError } from "../lib/api-error.js";
import { requireRole } from "../middleware/require-role.js";
import {
  classifyDeliveryOutcome,
  type DeliveryOutcome,
} from "../services/github/deliveries.js";
import { GitHubRedeliveryError, redeliverHookDelivery } from "../services/github/redeliver.js";
import type { AdminAppBindings } from "../types.js";

const REDELIVERY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
});

const DeliveryOutcomeFilterSchema = z.enum([
  "success",
  "http_failure",
  "unreachable",
]);

const ListDeliveriesQuerySchema = PaginationQuerySchema.extend({
  outcome: DeliveryOutcomeFilterSchema.optional(),
  status_code: z.coerce.number().int().optional(),
  unreachable: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  workspace_id: z.string().uuid().optional(),
  installation_id: z.string().trim().min(1).optional(),
  event: z.string().trim().min(1).optional(),
  delivered_from: z.string().datetime({ offset: true }).optional(),
  delivered_to: z.string().datetime({ offset: true }).optional(),
});

const DeliveryParamsSchema = z.object({
  id: z.string().uuid(),
});

const RedeliverBodySchema = z.object({
  confirm: z.literal(true),
});

export type WebhookDeliveryItem = {
  id: string;
  githubDeliveryId: string;
  githubGuid: string;
  externalInstallationId: string | null;
  integrationId: string | null;
  workspaceId: string | null;
  event: string;
  action: string | null;
  statusCode: number;
  status: string;
  duration: number | null;
  redelivery: boolean;
  outcome: DeliveryOutcome;
  deliveredAt: string;
  polledAt: string;
  createdAt: string;
};

function toDeliveryItem(row: {
  id: string;
  githubDeliveryId: string;
  githubGuid: string;
  externalInstallationId: string | null;
  integrationId: string | null;
  workspaceId: string | null;
  event: string;
  action: string | null;
  statusCode: number;
  status: string;
  duration: number | null;
  redelivery: boolean;
  deliveredAt: Date;
  polledAt: Date;
  createdAt: Date;
}): WebhookDeliveryItem {
  return {
    id: row.id,
    githubDeliveryId: row.githubDeliveryId,
    githubGuid: row.githubGuid,
    externalInstallationId: row.externalInstallationId,
    integrationId: row.integrationId,
    workspaceId: row.workspaceId,
    event: row.event,
    action: row.action,
    statusCode: row.statusCode,
    status: row.status,
    duration: row.duration,
    redelivery: row.redelivery,
    outcome: classifyDeliveryOutcome(row.statusCode),
    deliveredAt: row.deliveredAt.toISOString(),
    polledAt: row.polledAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function outcomeStatusCodeFilter(
  outcome: DeliveryOutcome,
): SQL {
  if (outcome === "unreachable") {
    return eq(webhookDeliveries.statusCode, 0);
  }

  if (outcome === "success") {
    return and(
      gte(webhookDeliveries.statusCode, 200),
      lte(webhookDeliveries.statusCode, 299),
    )!;
  }

  return and(
    gte(webhookDeliveries.statusCode, 300),
    lte(webhookDeliveries.statusCode, 599),
  )!;
}

function buildDeliveryFilters(
  query: z.infer<typeof ListDeliveriesQuerySchema>,
): SQL | undefined {
  const filters: SQL[] = [];

  if (query.outcome) {
    filters.push(outcomeStatusCodeFilter(query.outcome));
  } else if (query.unreachable === true) {
    filters.push(eq(webhookDeliveries.statusCode, 0));
  } else if (query.status_code !== undefined) {
    filters.push(eq(webhookDeliveries.statusCode, query.status_code));
  }

  if (query.workspace_id) {
    filters.push(eq(webhookDeliveries.workspaceId, query.workspace_id));
  }

  if (query.installation_id) {
    filters.push(
      eq(webhookDeliveries.externalInstallationId, query.installation_id),
    );
  }

  if (query.event) {
    filters.push(eq(webhookDeliveries.event, query.event));
  }

  if (query.delivered_from) {
    filters.push(gte(webhookDeliveries.deliveredAt, new Date(query.delivered_from)));
  }

  if (query.delivered_to) {
    filters.push(lte(webhookDeliveries.deliveredAt, new Date(query.delivered_to)));
  }

  if (filters.length === 0) {
    return undefined;
  }

  return and(...filters);
}

async function listWebhookDeliveries(
  database: Db,
  query: z.infer<typeof ListDeliveriesQuerySchema>,
) {
  const whereClause = buildDeliveryFilters(query);
  const offset = (query.page - 1) * query.page_size;

  const [totalRow] = await database
    .select({ total: count() })
    .from(webhookDeliveries)
    .where(whereClause);

  const rows = await database
    .select()
    .from(webhookDeliveries)
    .where(whereClause)
    .orderBy(desc(webhookDeliveries.deliveredAt))
    .limit(query.page_size)
    .offset(offset);

  return {
    items: rows.map(toDeliveryItem),
    page: query.page,
    pageSize: query.page_size,
    total: totalRow?.total ?? 0,
  };
}

function assertRedeliveryAllowed(deliveredAt: Date, now = new Date()): void {
  if (now.getTime() - deliveredAt.getTime() > REDELIVERY_MAX_AGE_MS) {
    throw new AdminHttpError(
      "Delivery is older than 30 days and cannot be redelivered",
      422,
      "REDELIVERY_EXPIRED",
    );
  }
}

async function recordRedeliveryAuditEvent(
  database: Db,
  params: {
    adminUserId: string;
    delivery: {
      id: string;
      githubDeliveryId: string;
      workspaceId: string | null;
      externalInstallationId: string | null;
      statusCode: number;
      event: string;
    };
  },
): Promise<void> {
  await database.insert(auditEvents).values({
    adminUserId: params.adminUserId,
    action: "webhook.redeliver",
    targetType: "webhook_delivery",
    targetId: params.delivery.githubDeliveryId,
    metadata: {
      deliveryId: params.delivery.id,
      githubDeliveryId: params.delivery.githubDeliveryId,
      workspaceId: params.delivery.workspaceId,
      externalInstallationId: params.delivery.externalInstallationId,
      statusCode: params.delivery.statusCode,
      event: params.delivery.event,
    },
  });
}

async function redeliverWebhookDelivery(
  database: Db,
  env: AdminEnv,
  params: {
    adminUserId: string;
    deliveryId: string;
  },
): Promise<{ githubDeliveryId: string }> {
  const [delivery] = await database
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, params.deliveryId))
    .limit(1);

  if (!delivery) {
    throw new AdminHttpError("Webhook delivery not found", 404, "NOT_FOUND");
  }

  assertRedeliveryAllowed(delivery.deliveredAt);

  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    throw new AdminHttpError(
      "GitHub App credentials are not configured",
      503,
      "GITHUB_APP_NOT_CONFIGURED",
    );
  }

  const jwt = await createAppJwt({
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
  });

  try {
    await redeliverHookDelivery(jwt, delivery.githubDeliveryId);
  } catch (error) {
    if (error instanceof GitHubRedeliveryError) {
      throw new AdminHttpError(
        "GitHub rejected the redelivery request",
        502,
        "GITHUB_REDELIVERY_FAILED",
      );
    }

    throw error;
  }

  await recordRedeliveryAuditEvent(database, {
    adminUserId: params.adminUserId,
    delivery,
  });

  return { githubDeliveryId: delivery.githubDeliveryId };
}

/** Webhook delivery list and manual redelivery routes (Admin PRD §9.2–9.3). */
export function registerWebhookDeliveryRoutes(api: Hono<AdminAppBindings>): void {
  const deliveries = new Hono<AdminAppBindings>();

  deliveries.get("/", requireRole("viewer"), async (c) => {
    const query = ListDeliveriesQuerySchema.parse(c.req.query());
    const result = await listWebhookDeliveries(c.get("db"), query);
    return c.json(result, 200);
  });

  deliveries.post("/:id/redeliver", requireRole("operator"), async (c) => {
    const params = DeliveryParamsSchema.parse(c.req.param());
    RedeliverBodySchema.parse(await c.req.json());

    const result = await redeliverWebhookDelivery(c.get("db"), c.get("env"), {
      adminUserId: c.get("adminUser").id,
      deliveryId: params.id,
    });

    return c.json(result, 200);
  });

  api.route("/webhook-deliveries", deliveries);
}
