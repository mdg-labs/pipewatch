import type { Db } from "@pipewatch/db";
import { publicIntegrations } from "@pipewatch/db-admin/public-read";
import { webhookDeliveries } from "@pipewatch/db-admin/schema";
import { createGuardedGitHubFetch } from "@pipewatch/utils";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

const GITHUB_API_BASE = "https://api.github.com";
const DELIVERIES_PATH = "/app/hook/deliveries";
const DELIVERIES_PER_PAGE = 100;

export type DeliveryOutcome = "success" | "http_failure" | "unreachable";

const gitHubHookDeliverySchema = z.object({
  id: z.number(),
  guid: z.string(),
  delivered_at: z.string(),
  redelivery: z.boolean(),
  duration: z.number(),
  status: z.string(),
  status_code: z.number(),
  event: z.string(),
  action: z.string().nullable(),
  installation_id: z.number().nullable(),
});

export type GitHubHookDelivery = z.infer<typeof gitHubHookDeliverySchema>;

export type InstallationMapping = {
  integrationId: string;
  workspaceId: string;
};

/** Classify delivery outcome for monitoring (Admin PRD §9.2). */
export function classifyDeliveryOutcome(statusCode: number): DeliveryOutcome {
  if (statusCode === 0) {
    return "unreachable";
  }

  if (statusCode >= 200 && statusCode <= 299) {
    return "success";
  }

  if (statusCode >= 300 && statusCode <= 599) {
    return "http_failure";
  }

  return "http_failure";
}

/** Parse the next-page URL from a GitHub `Link` response header. */
export function parseLinkNextUrl(linkHeader: string | null): string | null {
  if (!linkHeader) {
    return null;
  }

  for (const part of linkHeader.split(",")) {
    const section = part.trim();
    if (!section.includes('rel="next"') && !section.includes("rel=next")) {
      continue;
    }

    const urlMatch = section.match(/<([^>]+)>/);
    if (urlMatch?.[1]) {
      return urlMatch[1];
    }
  }

  return null;
}

/** Fetch all hook deliveries from GitHub with cursor pagination (Admin PRD §9.1). */
export async function fetchAllHookDeliveries(
  jwt: string,
  fetchImpl: typeof fetch = createGuardedGitHubFetch(),
): Promise<GitHubHookDelivery[]> {
  const deliveries: GitHubHookDelivery[] = [];
  let url: string | null =
    `${GITHUB_API_BASE}${DELIVERIES_PATH}?per_page=${String(DELIVERIES_PER_PAGE)}`;

  while (url) {
    const response = await fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      throw new Error(
        `GitHub hook deliveries request failed: ${String(response.status)}`,
      );
    }

    const page = z
      .array(gitHubHookDeliverySchema)
      .parse(await response.json());
    deliveries.push(...page);
    url = parseLinkNextUrl(response.headers.get("link"));
  }

  return deliveries;
}

/** Resolve GitHub installation ids to product integrations and workspaces. */
export async function loadInstallationMap(
  db: Db,
  installationIds: string[],
): Promise<Map<string, InstallationMapping>> {
  if (installationIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      integrationId: publicIntegrations.id,
      workspaceId: publicIntegrations.workspaceId,
      externalInstallationId: publicIntegrations.externalInstallationId,
    })
    .from(publicIntegrations)
    .where(
      and(
        eq(publicIntegrations.provider, "github"),
        inArray(publicIntegrations.externalInstallationId, installationIds),
      ),
    );

  return new Map(
    rows.map((row) => [
      row.externalInstallationId,
      {
        integrationId: row.integrationId,
        workspaceId: row.workspaceId,
      },
    ]),
  );
}

function toUpsertRow(
  delivery: GitHubHookDelivery,
  installationMap: Map<string, InstallationMapping>,
  polledAt: Date,
) {
  const externalInstallationId =
    delivery.installation_id !== null
      ? String(delivery.installation_id)
      : null;
  const match = externalInstallationId
    ? installationMap.get(externalInstallationId)
    : undefined;

  return {
    githubDeliveryId: String(delivery.id),
    githubGuid: delivery.guid,
    externalInstallationId,
    integrationId: match?.integrationId ?? null,
    workspaceId: match?.workspaceId ?? null,
    event: delivery.event,
    action: delivery.action,
    statusCode: delivery.status_code,
    status: delivery.status,
    duration: delivery.duration,
    redelivery: delivery.redelivery,
    deliveredAt: new Date(delivery.delivered_at),
    polledAt,
    firstPolledAt: polledAt,
  };
}

/** Upsert hook delivery rows — idempotent on `github_delivery_id` (Admin PRD §7.1). */
export async function upsertWebhookDeliveries(
  db: Db,
  deliveries: GitHubHookDelivery[],
  installationMap: Map<string, InstallationMapping>,
): Promise<number> {
  if (deliveries.length === 0) {
    return 0;
  }

  const polledAt = new Date();

  for (const delivery of deliveries) {
    const values = toUpsertRow(delivery, installationMap, polledAt);

    await db
      .insert(webhookDeliveries)
      .values(values)
      .onConflictDoUpdate({
        target: webhookDeliveries.githubDeliveryId,
        set: {
          githubGuid: values.githubGuid,
          externalInstallationId: values.externalInstallationId,
          integrationId: values.integrationId,
          workspaceId: values.workspaceId,
          event: values.event,
          action: values.action,
          statusCode: values.statusCode,
          status: values.status,
          duration: values.duration,
          redelivery: values.redelivery,
          deliveredAt: values.deliveredAt,
          polledAt: values.polledAt,
          // firstPolledAt intentionally omitted — set on insert only
        },
      });
  }

  return deliveries.length;
}
