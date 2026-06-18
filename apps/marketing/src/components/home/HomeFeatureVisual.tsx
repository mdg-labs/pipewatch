import type { featureHighlights } from "./home-content";

import "./home.css";

type FeatureVisualType = (typeof featureHighlights)[number]["visual"];

interface HomeFeatureVisualProps {
  type: FeatureVisualType;
}

export function HomeFeatureVisual({ type }: HomeFeatureVisualProps) {
  switch (type) {
    case "pipeline-dag":
      return <PipelineDagVisual />;
    case "repo-grid":
      return <RepoGridVisual />;
    case "insights-chart":
      return <InsightsChartVisual />;
    case "docker-compose":
      return <DockerComposeVisual />;
  }
}

function PipelineDagVisual() {
  return (
    <div className="home-mock-window">
      <div className="home-mock-window-header">
        <div className="home-window-dots home-window-dots-muted" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <span className="home-mock-window-title">CI · run #12847</span>
        <span className="home-mock-badge home-mock-badge-failure">Failed</span>
      </div>
      <div className="home-mock-window-body home-mock-dag">
        <p className="home-mock-label">Job execution graph</p>
        <svg className="home-mock-dag-svg" viewBox="0 0 440 110" aria-hidden>
          <defs>
            <marker id="home-dag-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0.5 L0,6.5 L6.5,3.5 z" fill="var(--border-strong)" />
            </marker>
          </defs>
          <path d="M92,52 C116,52 116,27 140,27" fill="none" stroke="var(--border-strong)" strokeWidth="1.5" markerEnd="url(#home-dag-arrow)" />
          <path d="M92,52 C116,52 116,80 140,80" fill="none" stroke="var(--border-strong)" strokeWidth="1.5" markerEnd="url(#home-dag-arrow)" />
        </svg>
        <div className="home-dag-node home-dag-node-success" style={{ left: "3%", top: "27%" }}>
          <span>lint</span>
          <span>23s</span>
        </div>
        <div className="home-dag-node home-dag-node-failure" style={{ left: "32%", top: "7%" }}>
          <span>test ✗</span>
          <span>2m 18s</span>
        </div>
        <div className="home-dag-node home-dag-node-success" style={{ left: "32%", top: "55%" }}>
          <span>typecheck</span>
          <span>31s</span>
        </div>
      </div>
    </div>
  );
}

function RepoGridVisual() {
  const cards = [
    { org: "mdg-labs/", repo: "inboxops", status: "running" as const, branch: "main" },
    { org: "mdg-labs/", repo: "slugbase", status: "failure" as const, branch: "24%↑" },
    { org: "mdg-labs/", repo: "pipewatch", status: "success" as const, branch: "main" },
    { org: "mdg-labs/", repo: "proxdroid", status: "cancelled" as const, branch: "feat/auth" },
  ];

  return (
    <div className="home-repo-grid">
      {cards.map((card) => (
        <div
          key={card.repo}
          className={`home-repo-grid-card ${card.status === "cancelled" ? "home-repo-grid-card-muted" : ""}`}
        >
          <div className="home-mini-repo-org">{card.org}</div>
          <div className="home-mini-repo-name">{card.repo}</div>
          <div className="home-repo-grid-meta">
            <span className={`home-mini-repo-status home-mini-repo-status-${card.status}`}>
              {card.status === "running" ? <span className="home-pulse-dot" aria-hidden /> : null}
              {card.status === "running"
                ? "Running"
                : card.status === "failure"
                  ? "Failed"
                  : card.status === "success"
                    ? "OK"
                    : "Cancelled"}
            </span>
            <span className="home-repo-grid-branch">{card.branch}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function InsightsChartVisual() {
  const bars = [42, 58, 35, 72, 48, 61, 39];

  return (
    <div className="home-mock-window">
      <div className="home-mock-window-header">
        <span className="home-mock-window-title">Failure rate · 7 days</span>
      </div>
      <div className="home-mock-window-body home-mock-insights">
        <div className="home-insights-bars" aria-hidden>
          {bars.map((height, index) => (
            <span
              key={index}
              className="home-insights-bar"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <div className="home-insights-stats">
          <div>
            <span className="home-insights-stat-label">Avg failure rate</span>
            <span className="home-insights-stat-value home-insights-stat-failure">8.4%</span>
          </div>
          <div>
            <span className="home-insights-stat-label">Slowest job</span>
            <span className="home-insights-stat-value">e2e · 14m</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DockerComposeVisual() {
  return (
    <div className="home-mock-window home-mock-terminal">
      <div className="home-mock-window-header">
        <div className="home-window-dots home-window-dots-muted" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <span className="home-mock-window-title">Terminal</span>
      </div>
      <div className="home-mock-window-body home-mock-code">
        <code>
          <span className="home-code-comment"># Clone and start PipeWatch CE</span>
          {"\n"}
          git clone https://github.com/mdg-labs/pipewatch
          {"\n"}
          cd pipewatch
          {"\n"}
          <span className="home-code-highlight">docker compose up -d</span>
          {"\n\n"}
          <span className="home-code-success">✓ API ready at http://localhost:8080</span>
        </code>
      </div>
    </div>
  );
}
