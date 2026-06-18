import Link from "next/link";

import { buttonClassName } from "@pipewatch/ui/components/button";

import { isWaitlistMode } from "@/lib/env";
import { getMarketingCta } from "@/lib/marketing-links";

import { SectionViewTracker } from "../home/SectionViewTracker";

import "./pricing.css";

export function PricingFinalCta() {
  const cta = getMarketingCta();
  const subtitle = isWaitlistMode()
    ? "Join the waitlist for Cloud or spin up PipeWatch CE on your own infrastructure today."
    : "Create your workspace on PipeWatch Cloud or self-host CE on your own infrastructure.";

  return (
    <SectionViewTracker sectionId="pricing-final-cta" eventName="pricing-section-view">
      <section className="pricing-final-cta" aria-labelledby="pricing-final-cta-heading">
        <div className="pricing-final-cta-inner">
          <h2 id="pricing-final-cta-heading" className="pricing-final-cta-title">
            Ready to see every pipeline in one place?
          </h2>
          <p className="pricing-final-cta-body">{subtitle}</p>
          <Link
            href={cta.href}
            className={buttonClassName({ variant: "primary", size: "lg" })}
            data-umami-event="pricing-cta-primary"
            data-umami-event-location="final-band"
          >
            {cta.label}
          </Link>
        </div>
      </section>
    </SectionViewTracker>
  );
}
