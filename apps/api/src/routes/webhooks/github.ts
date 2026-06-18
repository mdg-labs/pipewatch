import { createRoute } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { ApiEnv as ParsedApiEnv } from "@pipewatch/config/env";
import { parseApiEnv } from "@pipewatch/config/env";
import { getDb, type Db } from "@pipewatch/db";
import { integrations, repositories } from "@pipewatch/db/schema";
import {
  defaultJobOptionsFor,
  getQueue,
  QUEUE_NAMES,
} from "@pipewatch/worker/queues";
import { and, eq } from "drizzle-orm";

import { verifyGitHubWebhookSignature } from "../../lib/github-webhook-signature.js";
import { ApiErrorEnvelopeSchema, apiError } from "../../middleware/error-handler.js";
import { OpenApiTags } from "../../openapi-tags.js";
import type { ApiEnv } from "../../types.js";

const PROCESS_PIPELINE_RUN_JOB_NAME = "process-pipeline-run";
const PROCESS_PIPELINE_JOB_JOB_NAME = "process-pipeline-job";

const SUPPORTED_GITHUB_EVENTS = new Set(["workflow_run", "workflow_job"]);

const githubWebhookRoute = createRoute({
  method: "post",
  path: "/webhooks/github",
  tags: [OpenApiTags.WEBHOOKS],
  summary: "GitHub App webhook receiver",
  description:
    "Validates `X-Hub-Signature-256`, enqueues `workflow_run` and `workflow_job` events to BullMQ, and returns 200 immediately (PRD §12.6, pages B19).",
  responses: {
    200: {
      description: "Webhook accepted",
    },
    401: {
      description: "Invalid webhook signature",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
    500: {
      description: "Unexpected server error",
      content: {
        "application/json": {
          schema: ApiErrorEnvelopeSchema,
        },
      },
    },
  },
});

type GitHubWebhookEnvelope = {
  action?: string;
  installation?: { id?: number };
  repository?: { id?: number };
};

export type WebhookJobPayload = {
  workspaceId: string;
  repoId: string;
  action: string;
  payload: unknown;
  /** Globally unique delivery id from `X-GitHub-Delivery` (webhook redelivery dedup). */
  deliveryId?: string;
};

export type EnqueueWebhookEvent = (
  jobName: string,
  payload: WebhookJobPayload,
) => Promise<void>;

export type GitHubWebhookDependencies = {
  env: ParsedApiEnv;
  db: Db;
  enqueueWebhookEvent?: EnqueueWebhookEvent;
};

function resolveDatabase(deps?: Partial<GitHubWebhookDependencies>): Db {
  if (deps?.db) {
    return deps.db;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  return getDb();
}

function requireWebhookSecret(env: ParsedApiEnv): string {
  const secret = env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("GITHUB_WEBHOOK_SECRET is not configured");
  }

  return secret;
}

function requireRedisUrl(env: ParsedApiEnv): string {
  const redisUrl = env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is not configured");
  }

  return redisUrl;
}

function resolveEnqueueWebhookEvent(
  env: ParsedApiEnv,
  override?: EnqueueWebhookEvent,
): EnqueueWebhookEvent {
  if (override) {
    return override;
  }

  return async (jobName, payload) => {
    const redisUrl = requireRedisUrl(env);
    const queue = getQueue(QUEUE_NAMES.WEBHOOK_EVENTS, redisUrl);
    await queue.add(jobName, payload, defaultJobOptionsFor(QUEUE_NAMES.WEBHOOK_EVENTS));
  };
}

async function findEnabledWebhookRepository(
  database: Db,
  installationId: string,
  externalRepoId: string,
): Promise<{ workspaceId: string; repoId: string } | null> {
  const [row] = await database
    .select({
      workspaceId: repositories.workspaceId,
      repoId: repositories.id,
      enabled: repositories.enabled,
    })
    .from(repositories)
    .innerJoin(integrations, eq(repositories.integrationId, integrations.id))
    .where(
      and(
        eq(integrations.provider, "github"),
        eq(integrations.externalInstallationId, installationId),
        eq(repositories.externalRepoId, externalRepoId),
      ),
    )
    .limit(1);

  if (!row?.enabled) {
    return null;
  }

  return {
    workspaceId: row.workspaceId,
    repoId: row.repoId,
  };
}

function parseWebhookEnvelope(rawBody: string): GitHubWebhookEnvelope | null {
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    return parsed as GitHubWebhookEnvelope;
  } catch {
    return null;
  }
}

function resolveJobName(eventType: string): string | null {
  if (eventType === "workflow_run") {
    return PROCESS_PIPELINE_RUN_JOB_NAME;
  }

  if (eventType === "workflow_job") {
    return PROCESS_PIPELINE_JOB_JOB_NAME;
  }

  return null;
}

/** Register the GitHub webhook receiver (PRD §12.6, pages B19). */
export function registerGitHubWebhookRoute(
  app: OpenAPIHono<ApiEnv>,
  deps?: Partial<GitHubWebhookDependencies>,
): void {
  const resolveDeps = (): GitHubWebhookDependencies => {
    const env = deps?.env ?? parseApiEnv();
    return {
      env,
      db: resolveDatabase(deps),
      enqueueWebhookEvent: resolveEnqueueWebhookEvent(env, deps?.enqueueWebhookEvent),
    };
  };

  app.openapi(githubWebhookRoute, async (c) => {
    const resolved = resolveDeps();
    const rawBody = await c.req.text();
    const signatureHeader = c.req.header("X-Hub-Signature-256");

    let webhookSecret: string;
    try {
      webhookSecret = requireWebhookSecret(resolved.env);
    } catch {
      return c.json(apiError("INTERNAL_ERROR", "Webhook receiver is not configured"), 500);
    }

    if (!verifyGitHubWebhookSignature(rawBody, signatureHeader, webhookSecret)) {
      return c.json(apiError("UNAUTHORIZED", "Invalid webhook signature"), 401);
    }

    const eventType = c.req.header("X-GitHub-Event") ?? "";

    if (!SUPPORTED_GITHUB_EVENTS.has(eventType)) {
      return c.body(null, 200);
    }

    const envelope = parseWebhookEnvelope(rawBody);
    const installationId = envelope?.installation?.id;
    const repositoryId = envelope?.repository?.id;

    if (installationId === undefined || repositoryId === undefined) {
      return c.body(null, 200);
    }

    const repository = await findEnabledWebhookRepository(
      resolved.db,
      String(installationId),
      String(repositoryId),
    );

    if (!repository) {
      return c.body(null, 200);
    }

    const jobName = resolveJobName(eventType);
    if (!jobName) {
      return c.body(null, 200);
    }

    const action = envelope?.action ?? "";
    const payload: unknown = JSON.parse(rawBody);
    const deliveryId = c.req.header("X-GitHub-Delivery") ?? undefined;

    const jobPayload: WebhookJobPayload = {
      workspaceId: repository.workspaceId,
      repoId: repository.repoId,
      action,
      payload,
      ...(deliveryId ? { deliveryId } : {}),
    };

    try {
      await resolved.enqueueWebhookEvent!(jobName, jobPayload);
    } catch (error) {
      if (error instanceof Error && error.message === "REDIS_URL is not configured") {
        return c.json(apiError("SERVICE_UNAVAILABLE", "Webhook queue is unavailable"), 503);
      }

      throw error;
    }

    return c.body(null, 200);
  });
}

export {
  PROCESS_PIPELINE_JOB_JOB_NAME,
  PROCESS_PIPELINE_RUN_JOB_NAME,
  SUPPORTED_GITHUB_EVENTS,
};
