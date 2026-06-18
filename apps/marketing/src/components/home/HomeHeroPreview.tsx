import "./home.css";

export function HomeHeroPreview() {
  return (
    <div className="home-hero-preview-wrap">
      <div className="home-hero-preview">
        <div className="home-window-chrome">
          <div className="home-window-dots" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <div className="home-window-url">pipewatch.app/workspaces/my-workspace/</div>
        </div>

        <div className="home-hero-preview-body">
          <div className="home-mini-health-bar">
            <div className="home-mini-stat">
              <span className="home-mini-stat-label">Repos</span>
              <span className="home-mini-stat-value">14</span>
            </div>
            <div className="home-mini-stat home-mini-stat-running">
              <span className="home-mini-stat-label">Running</span>
              <span className="home-mini-stat-value">2</span>
            </div>
            <div className="home-mini-stat home-mini-stat-failure">
              <span className="home-mini-stat-label">Failing</span>
              <span className="home-mini-stat-value">1</span>
            </div>
            <div className="home-mini-stat home-mini-stat-success">
              <span className="home-mini-stat-label">Healthy</span>
              <span className="home-mini-stat-value">11</span>
            </div>
          </div>

          <div className="home-mini-card-grid">
            <MiniRepoCard org="mdg-labs/" repo="inboxops" status="running" stroke="var(--status-success)" path="M0,9 L13,7 L26,13 L40,3 L53,7 L66,9 L80,3" />
            <MiniRepoCard org="mdg-labs/" repo="slugbase" status="failure" stroke="var(--status-failure)" path="M0,5 L13,7 L26,3 L40,5 L53,8 L66,11 L80,13" />
            <MiniRepoCard org="mdg-labs/" repo="pipewatch" status="success" stroke="var(--status-success)" path="M0,5 L13,4 L26,5 L40,3 L53,4 L66,5 L80,3" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface MiniRepoCardProps {
  org: string;
  repo: string;
  status: "running" | "failure" | "success";
  stroke: string;
  path: string;
}

function MiniRepoCard({ org, repo, status, stroke, path }: MiniRepoCardProps) {
  const statusLabel =
    status === "running" ? "Running" : status === "failure" ? "Failed" : "Succeeded";

  return (
    <div className="home-mini-repo-card">
      <div className="home-mini-repo-org">{org}</div>
      <div className="home-mini-repo-name">{repo}</div>
      <div className={`home-mini-repo-status home-mini-repo-status-${status}`}>
        {status === "running" ? <span className="home-pulse-dot" aria-hidden /> : null}
        {statusLabel}
      </div>
      <svg className="home-mini-sparkline" viewBox="0 0 80 14" preserveAspectRatio="none" aria-hidden>
        <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
