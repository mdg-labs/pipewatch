"use client";

import { classNames } from "@pipewatch/ui";
import { useTranslations } from "next-intl";

import "./repo-detail.css";

export type WorkflowTabsProps = {
  workflows: string[];
  activeWorkflow: string | undefined;
  onWorkflowChange: (workflow: string | undefined) => void;
};

export function WorkflowTabs({
  workflows,
  activeWorkflow,
  onWorkflowChange,
}: WorkflowTabsProps) {
  const t = useTranslations("repos.workflowTabs");

  return (
    <div className="pw-repo-workflow-tabs" role="tablist" aria-label={t("ariaLabel")}>
      <button
        type="button"
        role="tab"
        className={classNames(
          "pw-repo-workflow-tab",
          !activeWorkflow && "pw-repo-workflow-tab-active",
        )}
        aria-selected={!activeWorkflow}
        onClick={() => onWorkflowChange(undefined)}
      >
        {t("all")}
      </button>
      {workflows.map((workflow) => (
        <button
          key={workflow}
          type="button"
          role="tab"
          className={classNames(
            "pw-repo-workflow-tab",
            activeWorkflow === workflow && "pw-repo-workflow-tab-active",
          )}
          aria-selected={activeWorkflow === workflow}
          onClick={() => onWorkflowChange(workflow)}
        >
          {workflow}
        </button>
      ))}
    </div>
  );
}
