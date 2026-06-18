import Link from "next/link";

import { buttonClassName } from "@pipewatch/ui/components/button";

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
        <Link
          href="/docs"
          className={buttonClassName({ variant: "secondary", size: "md" })}
          data-umami-event="pricing-ce-docs-cta"
        >
          View CE docs →
        </Link>
      </div>
    </section>
  );
}
