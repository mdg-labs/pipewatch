"use client";

import type { Workspace, WorkspaceRole } from "@pipewatch/types";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

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

type InviteErrorKind = "expired" | "invalid" | "accepted";

function mapPreviewError(
  error: unknown,
  tError: (key: string) => string,
): InviteLoadState {
  if (error instanceof InviteApiError) {
    if (error.status === 410) {
      return {
        status: "error",
        kind: "expired",
        message: tError("expiredMessage"),
      };
    }

    if (error.status === 409) {
      return {
        status: "error",
        kind: "accepted",
        message: tError("acceptedMessage"),
      };
    }

    if (error.status === 404) {
      return {
        status: "error",
        kind: "invalid",
        message: tError("invalidMessage"),
      };
    }
  }

  return {
    status: "error",
    kind: "invalid",
    message: tError("invalidMessage"),
  };
}

function InviteAcceptSkeleton({ ariaLabel }: { ariaLabel: string }) {
  return (
    <div className="pw-invite-accept-skeleton" aria-busy="true" aria-label={ariaLabel}>
      <Skeleton variant="line" width="70%" height={20} />
      <Skeleton variant="line" width="100%" height={72} />
      <Skeleton variant="line" width="100%" height={44} />
    </div>
  );
}

function InviteAcceptError({
  title,
  message,
  signInLabel,
}: {
  title: string;
  message: string;
  signInLabel: string;
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
        {signInLabel}
      </Link>
    </div>
  );
}

/** Invite acceptance card — workspace preview and accept CTA (pages B18). */
export function InviteAcceptCard({ token }: InviteAcceptCardProps) {
  const router = useRouter();
  const { api } = useApi();
  const { toast } = useToast();
  const t = useTranslations("invite");
  const tError = useTranslations("invite.error");
  const tJoin = useTranslations("invite.join");
  const tRoles = useTranslations("invite.roles");
  const tToast = useTranslations("invite.toast");
  const [loadState, setLoadState] = useState<InviteLoadState>({ status: "loading" });
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const formatRoleLabel = useCallback(
    (role: WorkspaceRole): string => {
      switch (role) {
        case "owner":
          return tRoles("owner");
        case "admin":
          return tRoles("admin");
        case "member":
          return tRoles("member");
      }
    },
    [tRoles],
  );

  const errorTitleForKind = useCallback(
    (kind: InviteErrorKind): string => {
      switch (kind) {
        case "expired":
          return tError("expiredTitle");
        case "accepted":
          return tError("acceptedTitle");
        case "invalid":
          return tError("invalidTitle");
      }
    },
    [tError],
  );

  const loadPreview = useCallback(async () => {
    setLoadState({ status: "loading" });
    setAcceptError(null);

    try {
      const preview = await fetchInvitePreview(publicApiUrl, token);
      setLoadState({ status: "ready", preview });
    } catch (error) {
      setLoadState(mapPreviewError(error, tError));
    }
  }, [tError, token]);

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
          title: tToast("joinedTitle"),
          description: tToast("joinedDescription"),
          variant: "info",
        });
      }

      const workspace = await api.get<Workspace>(`/workspaces/${result.workspace_id}`);

      toast({
        title: tToast("welcomeTitle"),
        description: tToast("welcomeDescription", {
          workspaceName: result.workspace_name,
          role: formatRoleLabel(result.role).toLowerCase(),
        }),
        variant: "success",
      });

      router.push(`/workspaces/${workspace.slug}`);
      router.refresh();
    } catch (error) {
      if (error instanceof InviteApiError) {
        if (error.status === 403) {
          setAcceptError(tJoin("wrongAccount"));
          return;
        }

        if (error.status === 410) {
          setLoadState({
            status: "error",
            kind: "expired",
            message: tError("expiredMessage"),
          });
          return;
        }

        if (error.status === 409) {
          setLoadState({
            status: "error",
            kind: "accepted",
            message: tError("acceptedMessage"),
          });
          return;
        }

        if (error.status === 404) {
          setLoadState({
            status: "error",
            kind: "invalid",
            message: tError("invalidMessage"),
          });
          return;
        }
      }

      toast({
        title: tToast("errorTitle"),
        description: tToast("errorDescription"),
        variant: "error",
      });
    } finally {
      setAccepting(false);
    }
  }, [
    accepting,
    api,
    formatRoleLabel,
    loadState,
    router,
    tError,
    tJoin,
    tToast,
    toast,
    token,
  ]);

  const errorTitle =
    loadState.status === "error" ? errorTitleForKind(loadState.kind) : "";

  return (
    <div className="pw-invite-accept-shell">
      <div className="pw-invite-accept-brand">
        <LogoWordmark markSize={40} />
      </div>

      <Card className="pw-invite-accept-card">
        {loadState.status === "loading" ? (
          <InviteAcceptSkeleton ariaLabel={t("loadingAriaLabel")} />
        ) : loadState.status === "error" ? (
          <InviteAcceptError
            title={errorTitle}
            message={loadState.message}
            signInLabel={tError("goToSignIn")}
          />
        ) : (
          <>
            <h1 className="pw-invite-accept-heading">{tJoin("heading")}</h1>
            <p className="pw-invite-accept-subtext">{tJoin("subtext")}</p>

            <div className="pw-invite-accept-details">
              <div className="pw-invite-accept-detail-row">
                <span className="pw-invite-accept-detail-label">{tJoin("workspaceLabel")}</span>
                <span className="pw-invite-accept-detail-value">
                  {loadState.preview.workspace_name}
                </span>
              </div>
              <div className="pw-invite-accept-detail-row">
                <span className="pw-invite-accept-detail-label">{tJoin("roleLabel")}</span>
                <span className="pw-invite-accept-detail-value">
                  {formatRoleLabel(loadState.preview.role)}
                </span>
              </div>
              <div className="pw-invite-accept-detail-row">
                <span className="pw-invite-accept-detail-label">{tJoin("invitedAsLabel")}</span>
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
                {accepting ? tJoin("accepting") : tJoin("accept")}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
