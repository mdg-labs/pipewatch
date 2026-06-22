
import { buttonClassName } from "@pipewatch/ui/components/button";

import { pricingPlans } from "./pricing-content";
import { getPlanCtaUrl } from "./pricing-links";

import "../home/home.css";
import "./pricing.css";

export function PricingPlanCards() {
  return (
    <section className="pricing-plans" aria-labelledby="pricing-plans-heading">
      <h2 id="pricing-plans-heading" className="visually-hidden">
        Choose a plan
      </h2>

      <div className="home-pricing-grid">
        {pricingPlans.map((plan) => (
          <article
            key={plan.id}
            className={`home-pricing-card ${plan.highlight ? "home-pricing-card-highlight" : ""}`}
          >
            {plan.badge ? <span className="home-pricing-badge">{plan.badge}</span> : null}

            <h3 className="home-pricing-name">{plan.name}</h3>
            <p className="home-pricing-price">
              <span>{plan.monthlyPrice}</span>
              <span className="home-pricing-period">{plan.period}</span>
            </p>
            <p className="home-pricing-summary">{plan.summary}</p>

            <ul className="home-pricing-features">
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>

            <a
              href={getPlanCtaUrl(plan.id)}
              className={buttonClassName({
                variant: plan.highlight ? "primary" : "secondary",
                size: "md",
              })}
              data-umami-event="pricing-plan-cta"
              data-umami-event-plan={plan.id}
            >
              {plan.ctaLabel}
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
