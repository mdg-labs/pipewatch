
import { buttonClassName } from "@pipewatch/ui/components/button";

import { getMarketingCta } from "@/lib/marketing-links";

import { pricingPlans } from "./home-content";
import { SectionViewTracker } from "./SectionViewTracker";

import "./home.css";

export function HomePricingPreview() {
  const cta = getMarketingCta();

  return (
    <SectionViewTracker sectionId="pricing" eventName="home-section-view">
      <section id="pricing" className="home-pricing" aria-labelledby="home-pricing-heading">
        <div className="home-pricing-header">
          <h2 id="home-pricing-heading" className="home-section-title home-section-title-center">
            Simple, usage-based pricing
          </h2>
          <p className="home-section-body home-section-body-center">
            No per-seat fees. Scale with repos and retention — or self-host CE for free.
          </p>
        </div>

        <div className="home-pricing-grid">
          {pricingPlans.map((plan) => (
            <article
              key={plan.id}
              className={`home-pricing-card ${plan.highlight ? "home-pricing-card-highlight" : ""}`}
            >
              {"badge" in plan && plan.badge ? (
                <span className="home-pricing-badge">{plan.badge}</span>
              ) : null}

              <h3 className="home-pricing-name">{plan.name}</h3>
              <p className="home-pricing-price">
                <span>{plan.price}</span>
                <span className="home-pricing-period">{plan.period}</span>
              </p>
              <p className="home-pricing-summary">{plan.summary}</p>

              <ul className="home-pricing-features">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>

              <a
                href={cta.href}
                className={buttonClassName({
                  variant: plan.highlight ? "primary" : "secondary",
                  size: "md",
                })}
                data-umami-event="home-cta-primary"
                data-umami-event-location={`pricing-${plan.id}`}
              >
                {cta.label}
              </a>
            </article>
          ))}
        </div>

        <p className="home-pricing-footer">
          <a
            href="/pricing"
            className="home-pricing-link"
            data-umami-event="home-cta-pricing-page"
          >
            See full pricing and plan comparison →
          </a>
        </p>
      </section>
    </SectionViewTracker>
  );
}
