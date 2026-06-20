"use client";

import { useTranslations } from "next-intl";

import type { DashboardHealthSummary } from "@/lib/dashboard-types";

import "./dashboard.css";

export type HealthBarProps = {
  health: DashboardHealthSummary;
};

export function HealthBar({ health }: HealthBarProps) {
  const t = useTranslations("dashboard.health");

  return (
    <div className="pw-dashboard-health" role="group" aria-label={t("ariaLabel")}>
      <div className="pw-dashboard-health-segment pw-dashboard-health-total">
        <div className="pw-dashboard-health-label">
          <span className="pw-dashboard-health-label-text">{t("repos")}</span>
        </div>
        <div className="pw-dashboard-health-value">{health.total}</div>
      </div>

      <div className="pw-dashboard-health-segment pw-dashboard-health-running">
        <div className="pw-dashboard-health-label">
          <span className="pw-dashboard-health-label-text">{t("running")}</span>
        </div>
        <div className="pw-dashboard-health-value">{health.running}</div>
      </div>

      <div className="pw-dashboard-health-segment pw-dashboard-health-failing">
        <div className="pw-dashboard-health-label">
          <span className="pw-dashboard-health-label-text">{t("failing")}</span>
        </div>
        <div className="pw-dashboard-health-value">{health.failing}</div>
      </div>

      <div className="pw-dashboard-health-segment pw-dashboard-health-healthy">
        <div className="pw-dashboard-health-label">
          <span className="pw-dashboard-health-label-text">{t("healthy")}</span>
        </div>
        <div className="pw-dashboard-health-value">{health.healthy}</div>
      </div>
    </div>
  );
}
