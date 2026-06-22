import { pricingFaqItems } from "./pricing-content";

import "./pricing.css";

export function PricingFaq() {
  return (
    <section className="pricing-faq" aria-labelledby="pricing-faq-heading">
      <h2 id="pricing-faq-heading" className="pricing-section-title">
        Frequently asked questions
      </h2>

      <div className="pricing-faq-list">
        {pricingFaqItems.map((item) => (
          <details key={item.id} className="pricing-faq-item">
            <summary className="pricing-faq-question">{item.question}</summary>
            <p className="pricing-faq-answer">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
