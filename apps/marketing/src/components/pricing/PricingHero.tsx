import { PricingBillingToggle } from "./PricingBillingToggle";

import "./pricing.css";

export function PricingHero() {
  return (
    <header className="pricing-hero">
      <h1 className="pricing-hero-title">Simple, usage-based pricing</h1>
      <p className="pricing-hero-body">
        No per-seat fees. Scale with repos and retention — or self-host PipeWatch CE for
        free.
      </p>
      <PricingBillingToggle />
    </header>
  );
}
