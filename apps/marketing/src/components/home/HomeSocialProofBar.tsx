import { GITHUB_REPO_URL } from "@/lib/marketing-links";

import { socialProofItems } from "./home-content";

import "./home.css";

interface HomeSocialProofBarProps {
  starCount: number | null;
}

function GitHubStarIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="var(--pw-amber-500)" aria-hidden>
      <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
    </svg>
  );
}

export function HomeSocialProofBar({ starCount }: HomeSocialProofBarProps) {
  return (
    <div className="home-social-proof">
      <div className="home-social-proof-inner">
        {socialProofItems.map((item, index) => (
          <span key={item} className="home-social-proof-group">
            {index > 0 ? <span className="home-social-proof-separator" aria-hidden>·</span> : null}
            <span className="home-social-proof-item">{item}</span>
          </span>
        ))}

        <span className="home-social-proof-group">
          <span className="home-social-proof-separator" aria-hidden>·</span>
          <a
            href={GITHUB_REPO_URL}
            className="home-social-proof-stars"
            target="_blank"
            rel="noopener noreferrer"
            data-umami-event="home-social-github"
          >
            <GitHubStarIcon />
            {starCount !== null ? (
              <span>{starCount.toLocaleString("en-US")} GitHub stars</span>
            ) : (
              <span>Star on GitHub</span>
            )}
          </a>
        </span>
      </div>
    </div>
  );
}
