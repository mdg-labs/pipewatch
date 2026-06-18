import { randomBytes } from "node:crypto";

import { closeDb, createDb, type Db } from "@pipewatch/db";
import {
  integrations,
  pipelineRuns,
  repositories,
  users,
  workspaceMembers,
  workspaces,
} from "@pipewatch/db/schema";
import { eq } from "drizzle-orm";

export type E2eSeedResult = {
  userId: string;
  workspaceId: string;
  workspaceSlug: string;
  integrationId: string;
  repositoryId: string;
  runId: string;
};

const E2E_OAUTH_USER = {
  githubId: 900_001n,
  githubLogin: "e2e-user",
  email: "e2e-user@example.com",
  name: "E2E User",
  avatarUrl: "https://example.com/e2e-avatar.png",
};

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for E2E seed helpers");
  }

  return databaseUrl;
}

async function ensureE2eOAuthUser(database: Db): Promise<{ id: string }> {
  const [existing] = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.githubLogin, E2E_OAUTH_USER.githubLogin))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [user] = await database
    .insert(users)
    .values(E2E_OAUTH_USER)
    .returning({ id: users.id });

  if (!user) {
    throw new Error("Failed to seed E2E OAuth user");
  }

  return user;
}

async function seedWorkspace(database: Db, slug: string): Promise<{ id: string; slug: string }> {
  const [workspace] = await database
    .insert(workspaces)
    .values({
      name: "E2E Dashboard Workspace",
      slug,
      plan: "free",
      defaultRetentionDays: 30,
    })
    .returning({ id: workspaces.id, slug: workspaces.slug });

  if (!workspace) {
    throw new Error("Failed to seed E2E workspace");
  }

  return workspace;
}

async function seedIntegration(database: Db, workspaceId: string): Promise<{ id: string }> {
  const suffix = randomBytes(4).toString("hex");
  const [integration] = await database
    .insert(integrations)
    .values({
      workspaceId,
      provider: "github",
      externalInstallationId: `install-${suffix}`,
      accountLogin: "e2e-org",
      accountType: "Organization",
      accessToken: "encrypted-placeholder",
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    .returning({ id: integrations.id });

  if (!integration) {
    throw new Error("Failed to seed E2E integration");
  }

  return integration;
}

async function seedRepository(
  database: Db,
  workspaceId: string,
  integrationId: string,
): Promise<{ id: string }> {
  const suffix = randomBytes(4).toString("hex");
  const [repository] = await database
    .insert(repositories)
    .values({
      workspaceId,
      integrationId,
      externalRepoId: `repo-${suffix}`,
      fullName: "e2e-org/pipewatch-app",
      private: false,
      enabled: true,
    })
    .returning({ id: repositories.id });

  if (!repository) {
    throw new Error("Failed to seed E2E repository");
  }

  return repository;
}

async function seedRun(
  database: Db,
  workspaceId: string,
  repoId: string,
): Promise<{ id: string }> {
  const suffix = randomBytes(4).toString("hex");
  const [run] = await database
    .insert(pipelineRuns)
    .values({
      workspaceId,
      repoId,
      externalRunId: `external-${suffix}`,
      pipelineName: "CI",
      pipelineDefinitionRef: ".github/workflows/ci.yml",
      status: "completed",
      conclusion: "success",
      branch: "main",
      commitSha: "abc123def456",
      commitMessage: "feat: e2e dashboard seed",
      actorLogin: "e2e-user",
      triggerType: "push",
      sourceUrl: `https://github.com/e2e-org/pipewatch-app/actions/runs/${suffix}`,
      startedAt: new Date("2026-06-10T12:00:00.000Z"),
      completedAt: new Date("2026-06-10T12:05:00.000Z"),
      durationMs: 300_000,
    })
    .returning({ id: pipelineRuns.id });

  if (!run) {
    throw new Error("Failed to seed E2E pipeline run");
  }

  return run;
}

/** Seed dashboard + run-detail fixtures for authenticated E2E flows. */
export async function seedDashboardFixture(slug: string): Promise<E2eSeedResult> {
  const database = createDb(requireDatabaseUrl());

  try {
    const user = await ensureE2eOAuthUser(database);
    const workspace = await seedWorkspace(database, slug);
    await database.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: user.id,
      role: "owner",
      acceptedAt: new Date(),
    });

    const integration = await seedIntegration(database, workspace.id);
    const repository = await seedRepository(database, workspace.id, integration.id);
    const run = await seedRun(database, workspace.id, repository.id);

    return {
      userId: user.id,
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
      integrationId: integration.id,
      repositoryId: repository.id,
      runId: run.id,
    };
  } finally {
    await closeDb();
  }
}

/** Insert tracked repositories after a mocked GitHub App install during onboarding E2E. */
export async function seedOnboardingRepositories(
  workspaceId: string,
  integrationId: string,
): Promise<void> {
  const database = createDb(requireDatabaseUrl());

  try {
    const suffix = randomBytes(4).toString("hex");
    await database.insert(repositories).values([
      {
        workspaceId,
        integrationId,
        externalRepoId: `onboard-a-${suffix}`,
        fullName: "e2e-org/alpha",
        private: false,
        enabled: false,
      },
      {
        workspaceId,
        integrationId,
        externalRepoId: `onboard-b-${suffix}`,
        fullName: "e2e-org/beta",
        private: true,
        enabled: false,
      },
    ]);
  } finally {
    await closeDb();
  }
}
