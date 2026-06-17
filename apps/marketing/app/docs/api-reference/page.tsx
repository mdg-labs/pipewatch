import type { Metadata } from "next";

import { CLOUD_API_DOCS_URL } from "@/lib/api-docs";

export const metadata: Metadata = {
  title: "API Reference — PipeWatch Docs",
};

export default function ApiReferencePage() {
  return (
    <main>
      <h1>API Reference</h1>
      <p>
        Interactive REST API documentation powered by Scalar — browse endpoints,
        inspect schemas, and try requests in your browser.
      </p>
      <p>
        <a href={CLOUD_API_DOCS_URL} target="_blank" rel="noopener noreferrer">
          Open API Reference
        </a>
      </p>
    </main>
  );
}
