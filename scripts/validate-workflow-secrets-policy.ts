#!/usr/bin/env node
/**
 * Enforce Phase → GHA secrets-only policy in workflow YAML.
 * Fails when workflows use vars.* for keys that must come from secrets.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { GITHUB_ACTIONS_VAR_EXCEPTIONS } from "../packages/config/github-actions-secrets.ts";

const REPO_ROOT = join(import.meta.dirname, "..");
const WORKFLOWS_DIR = join(REPO_ROOT, ".github/workflows");

const ALLOWED_VARS = new Set<string>(GITHUB_ACTIONS_VAR_EXCEPTIONS);

export type WorkflowSecretPolicyIssue = {
  file: string;
  line: number;
  varName: string;
  message: string;
};

export function findForbiddenWorkflowVars(content: string, file: string): WorkflowSecretPolicyIssue[] {
  const issues: WorkflowSecretPolicyIssue[] = [];
  const lines = content.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const pattern = /vars\.([A-Z][A-Z0-9_]*)/g;
    for (const match of line.matchAll(pattern)) {
      const varName = match[1]!;
      if (ALLOWED_VARS.has(varName)) {
        continue;
      }
      issues.push({
        file,
        line: index + 1,
        varName,
        message: `use secrets.${varName} — Phase sync stores all keys as GHA secrets`,
      });
    }
  }

  return issues;
}

export function validateWorkflowSecretsPolicy(workflowFiles: Array<{ path: string; content: string }>): WorkflowSecretPolicyIssue[] {
  return workflowFiles.flatMap(({ path, content }) =>
    findForbiddenWorkflowVars(content, path),
  );
}

function main(): void {
  const workflowFiles = readdirSync(WORKFLOWS_DIR)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .map((name) => {
      const path = join(WORKFLOWS_DIR, name);
      return { path: `.github/workflows/${name}`, content: readFileSync(path, "utf8") };
    });

  const issues = validateWorkflowSecretsPolicy(workflowFiles);
  if (issues.length > 0) {
    console.error("validate-workflow-secrets-policy: FAIL\n");
    for (const issue of issues) {
      console.error(`- ${issue.file}:${issue.line} vars.${issue.varName} — ${issue.message}`);
    }
    process.exit(1);
  }

  console.log("validate-workflow-secrets-policy: PASS");
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main();
}
