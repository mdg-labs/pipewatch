import { Redis } from "ioredis";

import type { PipelineJobSummary, PipelineRunSummary } from "@pipewatch/types";
import { getSseChannel, type SseEventType } from "@pipewatch/types";

export type PublishSseEventInput = {
  workspaceId: string;
  repoId: string;
  type: SseEventType;
  data: PipelineRunSummary | PipelineJobSummary;
};

let sharedPublisher: Redis | null = null;
let sharedPublisherUrl: string | null = null;

function resolvePublisher(redisUrl: string, override?: Redis): Redis {
  if (override) {
    return override;
  }

  if (sharedPublisher && sharedPublisherUrl === redisUrl) {
    return sharedPublisher;
  }

  if (sharedPublisher) {
    void sharedPublisher.quit();
  }

  sharedPublisher = new Redis(redisUrl, { maxRetriesPerRequest: null });
  sharedPublisherUrl = redisUrl;
  return sharedPublisher;
}

/** Publish a pipeline SSE event to the repo-scoped Redis pub/sub channel (PRD §19). */
export async function publishSseEvent(
  input: PublishSseEventInput,
  options?: { redisUrl?: string; redis?: Redis },
): Promise<void> {
  const redisUrl = options?.redisUrl ?? process.env.REDIS_URL;
  if (!redisUrl) {
    return;
  }

  const redis = resolvePublisher(redisUrl, options?.redis);
  const channel = getSseChannel(input.workspaceId, input.repoId);
  const message = JSON.stringify({ type: input.type, data: input.data });

  await redis.publish(channel, message);
}
