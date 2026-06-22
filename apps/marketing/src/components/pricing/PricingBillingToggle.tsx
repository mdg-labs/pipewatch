"use client";

import "./pricing.css";

/** Monthly/annual billing toggle — present for layout parity; annual is post-MVP (inert). */
export function PricingBillingToggle() {
  return (
    <div className="pricing-billing-toggle" role="group" aria-label="Billing period">
      <button type="button" className="pricing-billing-option pricing-billing-option-active" disabled>
        Monthly
      </button>
      <button
        type="button"
        className="pricing-billing-option pricing-billing-option-disabled"
        disabled
        aria-disabled="true"
        title="Annual billing coming soon"
      >
        Annual
        <span className="pricing-billing-soon">Soon</span>
      </button>
    </div>
  );
}
