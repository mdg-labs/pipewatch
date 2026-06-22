
import { homeAnchorLinks } from "./home-content";

import "./home.css";

export function HomeAnchorNav() {
  return (
    <nav className="home-anchor-nav" aria-label="Page sections">
      <div className="home-anchor-nav-inner">
        {homeAnchorLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="home-anchor-nav-link"
            data-umami-event={link.event}
          >
            {link.label}
          </a>
        ))}
        <a href="/pricing" className="home-anchor-nav-link home-anchor-nav-link-muted">
          Full pricing →
        </a>
      </div>
    </nav>
  );
}
