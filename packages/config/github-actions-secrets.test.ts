import { describe, expect, it } from "vitest";

import { GITHUB_ACTIONS_VAR_EXCEPTIONS } from "./github-actions-secrets.js";
import {
  findForbiddenWorkflowVars,
  validateWorkflowSecretsPolicy,
} from "../../scripts/validate-workflow-secrets-policy.ts";

describe("github-actions-secrets policy", () => {
  it("allows only workflow-managed GHA variables", () => {
    expect(GITHUB_ACTIONS_VAR_EXCEPTIONS).toEqual(["DEPLOYED_VERSION"]);
  });

  it("flags Phase-synced keys referenced via vars", () => {
    const issues = findForbiddenWorkflowVars(
      "REPORTPORTAL_URL: ${{ vars.REPORTPORTAL_URL }}",
      "ci.yml",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.varName).toBe("REPORTPORTAL_URL");
  });

  it("allows DEPLOYED_VERSION via vars", () => {
    const issues = findForbiddenWorkflowVars(
      'DEPLOYED="${{ vars.DEPLOYED_VERSION }}"',
      "release.yml",
    );
    expect(issues).toHaveLength(0);
  });

  it("passes on current workflow files", () => {
    const issues = validateWorkflowSecretsPolicy([
      {
        path: ".github/workflows/ci.yml",
        content: `
          REPORTPORTAL_URL: \${{ secrets.REPORTPORTAL_URL }}
        `,
      },
      {
        path: ".github/workflows/release.yml",
        content: `
          DEPLOYED="\${{ vars.DEPLOYED_VERSION }}"
        `,
      },
    ]);
    expect(issues).toEqual([]);
  });
});
