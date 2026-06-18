"use client";

import type { Workspace, WorkspaceRole } from "@pipewatch/types";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button, Card, LogoWordmark, Skeleton, buttonClassName } from "@pipewatch/ui";

import { useApi } from "@/hooks/use-api";
import {
  acceptInvite,
  fetchInvitePreview,
  InviteApiError,
  type InvitePreview,
} from "@/lib/invite-api";
import { publicApiUrl } from "@/lib/env";
import { switchWorkspace } from "@/lib/switch-workspace";
import { useToast } from "@/providers/ToastProvider";

import "./invite-accept.css";

export type InviteAcceptCardProps = {
  token: string;
};

type InviteLoadState =
  | { status: "loading" }
  | { status: "error"; kind: "expired" | "invalid" | "accepted"; message: string }
  | { status: "ready"; preview: InvitePreview };

function formatRoleLabel(role: WorkspaceRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "member":
      return "Member";
  }
}

function mapPreviewError(error: unknown): InviteLoadState {
  if (error instanceof InviteApiError) {
    if (error.status === 410) {
      return {
        status: "error",
        kind: "expired",
        message: "This invite has expired. Ask a workspace admin to send a new invite.",
      };
    }

    if (error.status === 409) {
      return {
        status: "error",
        kind: "accepted",
        message: "This invite has already been accepted.",
      };
    }

    if (error.status === 404) {
      return {
        status: "error",
        kind: "invalid",
        message: "This invite link is invalid or has been revoked.",
      };
    }
  }

  return {
    status: "error",
    kind: "invalid",
    message: "This invite link is invalid or has been revoked.",
  };
}

function InviteAcceptSkeleton() {
  return (
    <div className="pw-invite-accept-skeleton" aria-busy="true" aria-label="Loading invite">
      <Skeleton variant="line" width="70%" height={20} />
      <Skeleton variant="line" width="100%" height={72} />
      <Skeleton variant="line" width="100%" height={44} />
    </div>
  );
}

function InviteAcceptError({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="pw-invite-accept-error" role="alert">
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "var(--space-3)",
          color: "var(--text-tertiary)",
        }}
        aria-hidden
      >
        <AlertTriangle size={24} strokeWidth={1.75} />
      </div>
      <h1 className="pw-invite-accept-error-title">{title}</h1>
      <p className="pw-invite-accept-error-message">{message}</p>
      <Link
        href="/sign-in"
        className={buttonClassName({ variant: "secondary", size: "md" })}
        style={{ display: "inline-flex", justifyContent: "center", textDecoration: "none" }}
      >
        Go to sign in
      </Link>
    </div>
  );
}

/** Invite acceptance card — workspace preview and accept CTA (pages B18). */
export function InviteAcceptCard({ token }: InviteAcceptCardProps) {
  const router = useRouter();
  const { api } = useApi();
  const { toast } = useToast();
  const [loadState, setLoadState] = useState<InviteLoadState>({ status: "loading" });
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    setLoadState({ status: "loading" });
    setAcceptError(null);

    try {
      const preview = await fetchInvitePreview(publicApiUrl, token);
      setLoadState({ status: "ready", preview });
    } catch (error) {
      setLoadState(mapPreviewError(error));
    }
  }, [token]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const handleAccept = useCallback(async () => {
    if (loadState.status !== "ready" || accepting) {
      return;
    }

    setAccepting(true);
    setAcceptError(null);

    try {
      const result = await acceptInvite(publicApiUrl, token);
      const switched = await switchWorkspace(publicApiUrl, result.workspace_id);

      if (!switched.ok) {
        toast({
          title: "Joined workspace",
          description: "Refresh or sign in again if the dashboard does not load.",
          variant: "info",
        });
      }

      const workspace = await api.get<Workspace>(`/workspaces/${result.workspace_id}`);

      toast({
        title: "Welcome to the workspace",
        description: `You joined ${result.workspace_name} as ${formatRoleLabel(result.role).toLowerCase()}.`,
        variant: "success",
      });

      router.push(`/workspaces/${workspace.slug}`);
      router.refresh();
    } catch (error) {
      if (error instanceof InviteApiError) {
        if (error.status === 403) {
          setAcceptError(
            "This invite was sent to a different email address. Sign out and sign in with the invited email, then try again.",
          );
          return;
        }

        if (error.status === 410) {
          setLoadState({
            status: "error",
            kind: "expired",
            message: "This invite has expired. Ask a workspace admin to send a new invite.",
          });
          return;
        }

        if (error.status === 409) {
          setLoadState({
            status: "error",
            kind: "accepted",
            message: "This invite has already been accepted.",
          });
          return;
        }

        if (error.status === 404) {
          setLoadState({
            status: "error",
            kind: "invalid",
            message: "This invite link is invalid or has been revoked.",
          });
          return;
        }
      }

      toast({
        title: "Could not accept invite",
        description: "Try again in a moment.",
        variant: "error",
      });
    } finally {
      setAccepting(false);
    }
  }, [accepting, api, loadState, router, toast, token]);

  const errorTitle =
    loadState.status === "error"
      ? loadState.kind === "expired"
        ? "Invite expired"
        : loadState.kind === "accepted"
          ? "Invite already accepted"
          : "Invalid invite"
      : "";

  return (
    <div className="pw-invite-accept-shell">
      <div className="pw-invite-accept-brand">
        <LogoWordmark markSize={40} />
      </div>

      <Card className="pw-invite-accept-card">
        {loadState.status === "loading" ? (
          <InviteAcceptSkeleton />
        ) : loadState.status === "error" ? (
          <InviteAcceptError title={errorTitle} message={loadState.message} />
        ) : (
          <>
            <h1 className="pw-invite-accept-heading">Join workspace</h1>
            <p className="pw-invite-accept-subtext">
              You&apos;ve been invited to collaborate on PipeWatch.
            </p>

            <div className="pw-invite-accept-details">
              <div className="pw-invite-accept-detail-row">
                <span className="pw-invite-accept-detail-label">Workspace</span>
                <span className="pw-invite-accept-detail-value">
                  {loadState.preview.workspace_name}
                </span>
              </div>
              <div className="pw-invite-accept-detail-row">
                <span className="pw-invite-accept-detail-label">Role</span>
                <span className="pw-invite-accept-detail-value">
                  {formatRoleLabel(loadState.preview.role)}
                </span>
              </div>
              <div className="pw-invite-accept-detail-row">
                <span className="pw-invite-accept-detail-label">Invited as</span>
                <span className="pw-invite-accept-detail-value">{loadState.preview.email}</span>
              </div>
            </div>

            {acceptError ? (
              <p
                className="pw-invite-accept-error-message"
                role="alert"
                style={{ marginTop: 0 }}
              >
                {acceptError}
              </p>
            ) : null}

            <div className="pw-invite-accept-actions">
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  void handleAccept();
                }}
                disabled={accepting}
              >
                {accepting ? "Joining…" : "Accept invite"}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
