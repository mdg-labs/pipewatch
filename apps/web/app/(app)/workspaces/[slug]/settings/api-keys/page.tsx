"use client";

import { API_AUTH_INSTRUCTIONS, getApiDocsUrl } from "@/lib/api-docs";
import { publicApiUrl } from "@/lib/env";
import { useWorkspaceRole } from "@/hooks/use-workspace-role";

export default function WorkspaceApiKeysSettingsPage() {
  const { canMutate } = useWorkspaceRole();
  const apiDocsUrl = getApiDocsUrl();

  return (
    <section>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>API Keys</h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
        Programmatic API access keys will load here.
      </p>
      <button type="button" disabled={!canMutate}>
        Create API key
      </button>

      {publicApiUrl ? (
        <aside
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 8,
            border: "1px solid var(--border-default)",
            background: "var(--bg-surface)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>API documentation</h2>
          <p style={{ color: "var(--text-secondary)", marginTop: 8, marginBottom: 12 }}>
            Browse the interactive API reference for endpoint details, schemas, and
            try-it requests.
          </p>
          <p style={{ margin: 0 }}>
            <a href={apiDocsUrl} target="_blank" rel="noopener noreferrer">
              Open API docs
            </a>
          </p>
          <p
            style={{
              color: "var(--text-secondary)",
              marginTop: 16,
              marginBottom: 8,
              fontSize: 13,
            }}
          >
            Authenticate requests with a session JWT or a workspace API key:
          </p>
          <pre
            style={{
              margin: 0,
              padding: 12,
              borderRadius: 6,
              background: "var(--bg-elevated)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              lineHeight: 1.5,
              overflowX: "auto",
            }}
          >
            {`${API_AUTH_INSTRUCTIONS.jwt}\n${API_AUTH_INSTRUCTIONS.apiKey}`}
          </pre>
        </aside>
      ) : null}
    </section>
  );
}
