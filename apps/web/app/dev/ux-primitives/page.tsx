"use client";

import { Inbox } from "lucide-react";
import { useState } from "react";

import { Button, EmptyState } from "@pipewatch/ui";

import { CardSkeleton } from "@/components/CardSkeleton";
import { ErrorRetry } from "@/components/ErrorRetry";
import { TableSkeleton } from "@/components/TableSkeleton";
import { useToast } from "@/providers/ToastProvider";

import "./ux-primitives.css";

export default function UxPrimitivesDemoPage() {
  const { toast } = useToast();
  const [showError, setShowError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  return (
    <main className="pw-ux-demo">
      <header className="pw-ux-demo-header">
        <h1>Shared UX primitives</h1>
        <p>
          Reference patterns for loading, empty, error, and mutation feedback
          used across the PipeWatch app.
        </p>
      </header>

      <section className="pw-ux-demo-section">
        <h2>Toast notifications</h2>
        <p>Mutation feedback via the root ToastProvider.</p>
        <div className="pw-ux-demo-actions">
          <Button
            size="sm"
            onClick={() =>
              toast({ title: "Settings saved", variant: "success" })
            }
          >
            Success toast
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              toast({
                title: "Could not save",
                description: "Try again in a moment.",
                variant: "error",
              })
            }
          >
            Error toast
          </Button>
        </div>
      </section>

      <section className="pw-ux-demo-section">
        <h2>Skeleton loaders</h2>
        <p>Placeholder layouts while tables and cards load.</p>
        <div className="pw-ux-demo-stack">
          <CardSkeleton count={3} />
          <TableSkeleton columns={4} rows={4} />
        </div>
      </section>

      <section className="pw-ux-demo-section">
        <h2>Inline error + retry</h2>
        <p>Failed data loads show a retry action without leaving the page.</p>
        {showError ? (
          <ErrorRetry
            message="We could not load workflow runs. Check your connection and try again."
            onRetry={() => {
              setShowError(false);
              setRetryCount((count) => count + 1);
              toast({
                title: "Retrying load",
                variant: "info",
                duration: 2000,
              });
            }}
          />
        ) : (
          <div className="pw-ux-demo-actions">
            <Button size="sm" onClick={() => setShowError(true)}>
              Simulate load failure
            </Button>
            {retryCount > 0 ? (
              <span className="pw-ux-demo-meta">Retries: {retryCount}</span>
            ) : null}
          </div>
        )}
      </section>

      <section className="pw-ux-demo-section">
        <h2>Empty state</h2>
        <p>Designed zero-data states with a clear call to action.</p>
        <EmptyState
          icon={<Inbox size={28} strokeWidth={1.5} aria-hidden />}
          title="No runs yet"
          description="Workflow runs appear here once a repository is connected."
          actions={
            <Button size="sm">Connect GitHub</Button>
          }
        />
      </section>
    </main>
  );
}
