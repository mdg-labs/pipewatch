import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  collectOperationTags,
  normalizeOpenApiSpec,
  PRD_CLOUD_OPENAPI_PATHS,
  PRD_CORE_OPENAPI_PATHS,
  PRD_OPENAPI_TAGS,
  type OpenApiSpec,
} from "./openapi-spec.js";
import { OPENAPI_SPEC_PATH } from "./routes/openapi.js";

const snapshotPath = join(dirname(fileURLToPath(import.meta.url)), "openapi.json");

async function loadOpenApiSpec(edition: "ce" | "cloud"): Promise<OpenApiSpec> {
  vi.resetModules();
  process.env.PIPEWATCH_EDITION = edition;

  const { createApp } = await import("./app.js");
  const app = createApp();
  const response = await app.request(OPENAPI_SPEC_PATH);

  expect(response.status).toBe(200);
  return (await response.json()) as OpenApiSpec;
}

describe("openapi integration", () => {
  afterEach(() => {
    vi.resetModules();
    delete process.env.PIPEWATCH_EDITION;
  });

  it("documents all PRD §7 core routes", async () => {
    const spec = await loadOpenApiSpec("ce");

    for (const path of PRD_CORE_OPENAPI_PATHS) {
      expect(spec.paths, `missing path ${path}`).toHaveProperty(path);
    }
  });

  it("documents cloud-only PRD §7 routes when edition is cloud", async () => {
    const spec = await loadOpenApiSpec("cloud");

    for (const path of PRD_CLOUD_OPENAPI_PATHS) {
      expect(spec.paths, `missing cloud path ${path}`).toHaveProperty(path);
    }
  });

  it("uses resource tags matching PRD §7 CRUD matrix groups", async () => {
    const spec = await loadOpenApiSpec("cloud");
    const tags = collectOperationTags(spec);

    for (const expectedTag of PRD_OPENAPI_TAGS) {
      expect(tags, `missing tag ${expectedTag}`).toContain(expectedTag);
    }
  });

  it("includes Scalar x-tagGroups for resource grouping", async () => {
    const spec = await loadOpenApiSpec("ce");

    expect(spec["x-tagGroups"]).toBeDefined();
    expect(spec["x-tagGroups"]!.length).toBeGreaterThan(0);

    const groupedTags = spec["x-tagGroups"]!.flatMap((group) => group.tags);
    expect(groupedTags).toContain("Auth");
    expect(groupedTags).toContain("Pipeline Runs");
    expect(groupedTags).toContain("Integrations");
  });

  it("registers vendor-neutral component schemas from PRD §7", async () => {
    const spec = await loadOpenApiSpec("ce");
    const schemas = Object.keys(spec.components?.schemas ?? {});

    const requiredSchemas = [
      "Workspace",
      "IntegrationSummary",
      "RepositorySummary",
      "PipelineRun",
      "PipelineJob",
      "PipelineStep",
      "ApiKeySummary",
      "WorkspaceMember",
      "WorkspaceInvite",
      "WorkspaceInsights",
      "ApiError",
    ];

    for (const name of requiredSchemas) {
      expect(schemas, `missing schema ${name}`).toContain(name);
    }
  });

  it("matches committed openapi.json snapshot (cloud edition)", async () => {
    const spec = normalizeOpenApiSpec(await loadOpenApiSpec("cloud"));

    if (process.env.UPDATE_OPENAPI_SNAPSHOT === "1") {
      writeFileSync(snapshotPath, `${JSON.stringify(spec, null, 2)}\n`);
    }

    const snapshot = normalizeOpenApiSpec(
      JSON.parse(readFileSync(snapshotPath, "utf8")) as OpenApiSpec,
    );

    expect(spec).toEqual(snapshot);
  });
});
