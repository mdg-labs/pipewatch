import type { ComparisonCell } from "./pricing-content";
import { comparisonRows } from "./pricing-content";

import "./pricing.css";

function ComparisonCellValue({ cell }: { cell: ComparisonCell }) {
  if (cell.kind === "check") {
    return (
      <span className="pricing-comparison-check" aria-label="Included">
        ✓
      </span>
    );
  }

  if (cell.kind === "dash") {
    return (
      <span className="pricing-comparison-dash" aria-label="Not included">
        —
      </span>
    );
  }

  if (cell.kind === "soon") {
    return <span className="pricing-comparison-soon">Soon</span>;
  }

  return <span>{cell.value}</span>;
}

export function PricingComparisonTable() {
  return (
    <section className="pricing-comparison" aria-labelledby="pricing-comparison-heading">
      <h2 id="pricing-comparison-heading" className="pricing-section-title">
        Compare plans
      </h2>
      <p className="pricing-section-body">
        Every feature at a glance. Future capabilities are marked &ldquo;Soon&rdquo;.
      </p>

      <div className="pricing-comparison-scroll">
        <table className="pricing-comparison-table">
          <thead>
            <tr>
              <th scope="col">Feature</th>
              <th scope="col">Free</th>
              <th scope="col">Pro</th>
              <th scope="col">Business</th>
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.feature}</th>
                <td>
                  <ComparisonCellValue cell={row.free} />
                </td>
                <td>
                  <ComparisonCellValue cell={row.pro} />
                </td>
                <td>
                  <ComparisonCellValue cell={row.business} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
