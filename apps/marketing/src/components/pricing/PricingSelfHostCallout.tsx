import { buttonClassName } from "@pipewatch/ui/components/button";

import { CUSTOMER_DOCS_URL } from "@/lib/marketing-links";

import "./pricing.css";

export function PricingSelfHostCallout() {
  return (
    <section className="pricing-self-host" aria-labelledby="pricing-self-host-heading">
      <div className="pricing-self-host-inner">
        <div className="pricing-self-host-copy">
          <h2 id="pricing-self-host-heading" className="pricing-self-host-title">
            Want it all for free? Self-host PipeWatch CE
          </h2>
          <p className="pricing-self-host-body">
            Run PipeWatch on your own infrastructure with Docker Compose. Same codebase,
            no licence key, all features included — forever.
          </p>
        </div>
        <a
          href={CUSTOMER_DOCS_URL}
          className={buttonClassName({ variant: "secondary", size: "md" })}
          data-umami-event="pricing-ce-docs-cta"
          target="_blank"
          rel="noopener noreferrer"
        >
          View CE docs →
        </a>
      </div>
    </section>
  );
}
