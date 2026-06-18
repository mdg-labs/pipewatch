import { PricingComparisonTable } from "./PricingComparisonTable";
import { PricingFaq } from "./PricingFaq";
import { PricingFinalCta } from "./PricingFinalCta";
import { PricingHero } from "./PricingHero";
import { PricingPlanCards } from "./PricingPlanCards";
import { PricingSelfHostCallout } from "./PricingSelfHostCallout";

import "./pricing.css";

export function PricingPage() {
  return (
    <div className="pricing-page">
      <PricingHero />
      <PricingPlanCards />
      <PricingComparisonTable />
      <PricingSelfHostCallout />
      <PricingFaq />
      <PricingFinalCta />
    </div>
  );
}
