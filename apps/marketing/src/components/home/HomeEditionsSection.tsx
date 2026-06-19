import Link from "next/link";

import { buttonClassName } from "@pipewatch/ui/components/button";
import { Logo } from "@pipewatch/ui/components/logo";

import { CUSTOMER_DOCS_URL, getMarketingCta } from "@/lib/marketing-links";

import { SectionViewTracker } from "./SectionViewTracker";

import "./home.css";

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke="var(--status-success)" strokeWidth="1.5" />
      <path d="M5 8l2 2 4-4" stroke="var(--status-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HomeEditionsSection() {
  const cta = getMarketingCta();

  return (
    <SectionViewTracker sectionId="editions" eventName="home-section-view">
      <section id="editions" className="home-editions" aria-labelledby="home-editions-heading">
        <div className="home-editions-header">
          <h2 id="home-editions-heading" className="home-section-title home-section-title-center">
            Two ways to run PipeWatch
          </h2>
          <p className="home-section-body home-section-body-center">
            Same product. Your choice of deployment.
          </p>
        </div>

        <div className="home-editions-grid">
          <article className="home-edition-card">
            <div className="home-edition-card-header">
              <Logo size={20} aria-hidden />
              <h3 className="home-edition-name">PipeWatch CE</h3>
              <span className="home-edition-badge">CE</span>
            </div>
            <p className="home-edition-tagline">Self-hosted. Free forever.</p>

            <div className="home-edition-code">
              <span className="home-edition-code-label">Docker Compose</span>
              <code>docker compose up -d pipewatch</code>
            </div>

            <ul className="home-edition-features">
              <li><CheckIcon /> All features included</li>
              <li><CheckIcon /> No licence key required</li>
              <li><CheckIcon /> Your data, your infrastructure</li>
            </ul>

            <a
              href={CUSTOMER_DOCS_URL}
              className={buttonClassName({ variant: "secondary", size: "md" })}
              data-umami-event="home-cta-docs"
              data-umami-event-location="editions-ce"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read the docs →
            </a>
          </article>

          <article className="home-edition-card home-edition-card-accent">
            <div className="home-edition-glow" aria-hidden />
            <div className="home-edition-card-header">
              <Logo size={20} aria-hidden />
              <h3 className="home-edition-name">PipeWatch Cloud</h3>
              <span className="home-edition-badge">Cloud</span>
            </div>
            <p className="home-edition-tagline">Managed. Fair pricing.</p>

            <div className="home-edition-highlight">
              <strong>Free plan available</strong>
              <span>No credit card. Scales with your team.</span>
            </div>

            <ul className="home-edition-features">
              <li><CheckIcon /> Zero ops — we handle infra</li>
              <li><CheckIcon /> SOC 2 Type II certified</li>
              <li><CheckIcon /> EU data residency available</li>
            </ul>

            <Link
              href={cta.href}
              className={buttonClassName({ variant: "primary", size: "md" })}
              data-umami-event="home-cta-primary"
              data-umami-event-location="editions-cloud"
            >
              {cta.label} →
            </Link>
          </article>
        </div>
      </section>
    </SectionViewTracker>
  );
}
