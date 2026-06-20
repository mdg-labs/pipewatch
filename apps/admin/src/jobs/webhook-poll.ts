import type { AdminEnv } from "@pipewatch/config/env";
import type { Db } from "@pipewatch/db";
import { createAppJwt } from "@pipewatch/github-app-auth";

import {
  fetchAllHookDeliveries,
  loadInstallationMap,
  upsertWebhookDeliveries,
} from "../services/github/deliveries.js";

export type WebhookPollDeps = {
  env: AdminEnv;
  db: Db;
  fetchImpl?: typeof fetch;
};

/** Poll GitHub hook deliveries and upsert into `admin.webhook_deliveries`. */
export async function runWebhookPollJob(deps: WebhookPollDeps): Promise<number> {
  const { env, db, fetchImpl } = deps;

  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    throw new Error("GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY are required");
  }

  const jwt = await createAppJwt({
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
  });

  const deliveries = await fetchAllHookDeliveries(jwt, fetchImpl);
  const installationIds = [
    ...new Set(
      deliveries
        .map((delivery) =>
          delivery.installation_id !== null
            ? String(delivery.installation_id)
            : null,
        )
        .filter((id): id is string => id !== null),
    ),
  ];

  const installationMap = await loadInstallationMap(db, installationIds);
  return upsertWebhookDeliveries(db, deliveries, installationMap);
}
