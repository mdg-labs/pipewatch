import { describe, expect, it } from "vitest";

import {
  classifyDeliveryOutcome,
  parseLinkNextUrl,
} from "./deliveries.js";

describe("classifyDeliveryOutcome", () => {
  it("classifies 2xx responses as success", () => {
    expect(classifyDeliveryOutcome(200)).toBe("success");
    expect(classifyDeliveryOutcome(204)).toBe("success");
    expect(classifyDeliveryOutcome(299)).toBe("success");
  });

  it("classifies 300-599 responses as http_failure", () => {
    expect(classifyDeliveryOutcome(300)).toBe("http_failure");
    expect(classifyDeliveryOutcome(404)).toBe("http_failure");
    expect(classifyDeliveryOutcome(500)).toBe("http_failure");
    expect(classifyDeliveryOutcome(599)).toBe("http_failure");
  });

  it("classifies status_code 0 as unreachable", () => {
    expect(classifyDeliveryOutcome(0)).toBe("unreachable");
  });
});

describe("parseLinkNextUrl", () => {
  it("extracts the next page URL from a GitHub Link header", () => {
    const link =
      '<https://api.github.com/app/hook/deliveries?cursor=abc&per_page=100>; rel="next", ' +
      '<https://api.github.com/app/hook/deliveries?cursor=def&per_page=100>; rel="prev"';

    expect(parseLinkNextUrl(link)).toBe(
      "https://api.github.com/app/hook/deliveries?cursor=abc&per_page=100",
    );
  });

  it("returns null when there is no next link", () => {
    expect(parseLinkNextUrl(null)).toBeNull();
    expect(
      parseLinkNextUrl(
        '<https://api.github.com/app/hook/deliveries?cursor=def&per_page=100>; rel="prev"',
      ),
    ).toBeNull();
  });
});
