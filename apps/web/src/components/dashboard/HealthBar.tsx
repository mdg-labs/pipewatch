import type { DashboardHealthSummary } from "@/lib/dashboard-types";

import "./dashboard.css";

export type HealthBarProps = {
  health: DashboardHealthSummary;
};

export function HealthBar({ health }: HealthBarProps) {
  return (
    <div className="pw-dashboard-health" role="group" aria-label="Repository health summary">
      <div className="pw-dashboard-health-segment pw-dashboard-health-total">
        <div className="pw-dashboard-health-label">
          <span className="pw-dashboard-health-label-text">Repos</span>
        </div>
        <div className="pw-dashboard-health-value">{health.total}</div>
      </div>

      <div className="pw-dashboard-health-segment pw-dashboard-health-running">
        <div className="pw-dashboard-health-label">
          <span className="pw-dashboard-health-label-text">Running</span>
        </div>
        <div className="pw-dashboard-health-value">{health.running}</div>
      </div>

      <div className="pw-dashboard-health-segment pw-dashboard-health-failing">
        <div className="pw-dashboard-health-label">
          <span className="pw-dashboard-health-label-text">Failing</span>
        </div>
        <div className="pw-dashboard-health-value">{health.failing}</div>
      </div>

      <div className="pw-dashboard-health-segment pw-dashboard-health-healthy">
        <div className="pw-dashboard-health-label">
          <span className="pw-dashboard-health-label-text">Healthy</span>
        </div>
        <div className="pw-dashboard-health-value">{health.healthy}</div>
      </div>
    </div>
  );
}
