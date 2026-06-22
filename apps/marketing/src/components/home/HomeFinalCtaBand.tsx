
import { buttonClassName } from "@pipewatch/ui/components/button";

import { isWaitlistMode } from "@/lib/env";
import { getMarketingCta } from "@/lib/marketing-links";

import { SectionViewTracker } from "./SectionViewTracker";

import "./home.css";

export function HomeFinalCtaBand() {
  const cta = getMarketingCta();
  const subtitle = isWaitlistMode()
    ? "Join the waitlist for Cloud or spin up PipeWatch CE on your own infrastructure today."
    : "Create your workspace on PipeWatch Cloud or self-host CE on your own infrastructure.";

  return (
    <SectionViewTracker sectionId="final-cta" eventName="home-section-view">
      <section className="home-final-cta" aria-labelledby="home-final-cta-heading">
        <div className="home-final-cta-inner">
          <h2 id="home-final-cta-heading" className="home-final-cta-title">
            Ready to see every pipeline in one place?
          </h2>
          <p className="home-final-cta-body">{subtitle}</p>
          <a
            href={cta.href}
            className={buttonClassName({ variant: "primary", size: "lg" })}
            data-umami-event="home-cta-primary"
            data-umami-event-location="final-band"
          >
            {cta.label}
          </a>
        </div>
      </section>
    </SectionViewTracker>
  );
}
