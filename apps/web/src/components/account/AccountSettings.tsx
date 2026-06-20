"use client";

import type { UpdateUserProfileInput, UserProfile, WorkspaceRole } from "@pipewatch/types";
import { Github } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Avatar,
  Badge,
  Button,
  Card,
  DangerZone,
  DangerZoneItem,
  Input,
  TypedConfirmDialog,
} from "@pipewatch/ui";

import { CardSkeleton } from "@/components/CardSkeleton";
import { ErrorRetry } from "@/components/ErrorRetry";
import { useApi } from "@/hooks/use-api";
import { ApiClientError } from "@/lib/api-client";
import { clearAccessToken } from "@/lib/auth";
import { publicApiUrl } from "@/lib/env";
import { switchWorkspace } from "@/lib/switch-workspace";
import { useToast } from "@/providers/ToastProvider";

import "./account-settings.css";

const ROLE_BADGE_VARIANT = {
  owner: "accent",
  admin: "default",
  member: "outline",
} as const;

/** Account settings — profile, workspaces, sessions, delete (B13). */
export function AccountSettings() {
  const router = useRouter();
  const { api, workspaceId, workspaces } = useApi();
  const { toast } = useToast();
  const t = useTranslations("account");
  const tRoles = useTranslations("invite.roles");
  const tUi = useTranslations("ui");

  const deleteConfirmPhrase = t("danger.confirmPhrase");

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const roleLabel = useCallback(
    (role: WorkspaceRole) => tRoles(role),
    [tRoles],
  );

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    try {
      const data = await api.get<UserProfile>("/users/me");
      setProfile(data);
      setName(data.name ?? "");
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const hasNameChange = useMemo(() => {
    if (!profile) {
      return false;
    }

    return name.trim() !== (profile.name ?? "");
  }, [name, profile]);

  const handleSaveName = useCallback(async () => {
    if (!profile || !hasNameChange || saving) {
      return;
    }

    const body: UpdateUserProfileInput = {
      name: name.trim().length > 0 ? name.trim() : null,
    };

    setSaving(true);
    try {
      const updated = await api.patch<UserProfile>("/users/me", body);
      setProfile(updated);
      setName(updated.name ?? "");
      toast({
        title: t("toast.profileUpdatedTitle"),
        variant: "success",
      });
      router.refresh();
    } catch {
      toast({
        title: t("toast.profileUpdateErrorTitle"),
        description: t("toast.profileUpdateErrorDescription"),
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }, [api, hasNameChange, name, profile, router, saving, t, toast]);

  const handleSwitchWorkspace = useCallback(
    async (targetWorkspaceId: string, slug: string) => {
      if (!publicApiUrl || switchingId) {
        return;
      }

      setSwitchingId(targetWorkspaceId);
      try {
        const result = await switchWorkspace(publicApiUrl, targetWorkspaceId);

        if (!result.ok) {
          toast({
            title: t("toast.workspaceSwitchErrorTitle"),
            description: t("toast.workspaceSwitchErrorDescription"),
            variant: "error",
          });
          return;
        }

        toast({
          title: t("toast.workspaceSwitchedTitle"),
          variant: "success",
        });
        router.push(`/workspaces/${slug}`);
        router.refresh();
      } catch {
        toast({
          title: t("toast.workspaceSwitchErrorTitle"),
          description: t("toast.workspaceSwitchErrorRetry"),
          variant: "error",
        });
      } finally {
        setSwitchingId(null);
      }
    },
    [router, switchingId, t, toast],
  );

  const handleLogoutAll = useCallback(async () => {
    if (!publicApiUrl || loggingOutAll) {
      return;
    }

    setLoggingOutAll(true);
    try {
      const response = await fetch(`${publicApiUrl.replace(/\/$/, "")}/auth/logout-all`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("logout-all failed");
      }

      clearAccessToken();
      toast({
        title: t("toast.signedOutEverywhereTitle"),
        variant: "success",
      });
      window.location.assign("/sign-in");
    } catch {
      toast({
        title: t("toast.signOutEverywhereErrorTitle"),
        description: t("toast.signOutEverywhereErrorDescription"),
        variant: "error",
      });
      setLoggingOutAll(false);
    }
  }, [loggingOutAll, t, toast]);

  const handleDeleteAccount = useCallback(async () => {
    if (!profile || deleting) {
      return;
    }

    setDeleting(true);
    try {
      await api.delete("/users/me");
      clearAccessToken();
      toast({
        title: t("toast.accountDeletedTitle"),
        variant: "success",
      });
      setDeleteOpen(false);
      window.location.assign("/sign-in");
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        toast({
          title: t("toast.deleteConflictTitle"),
          description: t("toast.deleteConflictDescription"),
          variant: "error",
        });
        setDeleteOpen(false);
      } else {
        toast({
          title: t("toast.deleteErrorTitle"),
          description: t("toast.deleteErrorDescription"),
          variant: "error",
        });
      }
    } finally {
      setDeleting(false);
    }
  }, [api, deleting, profile, t, toast]);

  if (loading) {
    return <CardSkeleton count={3} />;
  }

  if (loadError || !profile) {
    return (
      <ErrorRetry
        message={t("loadError")}
        onRetry={() => {
          void loadProfile();
        }}
      />
    );
  }

  const displayName = profile.name?.trim() || profile.github_login;

  return (
    <div className="pw-account-settings">
      <header className="pw-account-settings-header">
        <h1>{t("title")}</h1>
        <p>{t("subtitle")}</p>
      </header>

      <section
        className="pw-account-settings-section"
        aria-labelledby="pw-account-profile-title"
      >
        <h2 id="pw-account-profile-title" className="pw-account-settings-section-title">
          {t("profile.title")}
        </h2>

        <div className="pw-account-profile-row">
          <Avatar
            name={displayName}
            {...(profile.avatar_url ? { src: profile.avatar_url } : {})}
            size="lg"
            rounded
          />
          <div className="pw-account-profile-fields">
            <Input
              label={t("profile.displayName")}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
              autoComplete="name"
            />
            <Input
              label={t("profile.email")}
              value={profile.email ?? ""}
              disabled
              hint={t("profile.emailHint")}
            />
          </div>
        </div>

        <div className="pw-account-settings-actions">
          <Button
            disabled={!hasNameChange}
            loading={saving}
            onClick={() => {
              void handleSaveName();
            }}
          >
            {saving ? t("profile.saveSaving") : t("profile.saveChanges")}
          </Button>
        </div>
      </section>

      <section
        className="pw-account-settings-section"
        aria-labelledby="pw-account-connected-title"
      >
        <h2 id="pw-account-connected-title" className="pw-account-settings-section-title">
          {t("connected.title")}
        </h2>

        <Card>
          <div className="pw-account-connected-row">
            <div className="pw-account-connected-meta">
              <span className="pw-account-connected-provider">
                <Github
                  size={14}
                  aria-hidden
                  style={{ marginRight: 6, verticalAlign: "text-bottom" }}
                />
                {t("connected.github")}
              </span>
              <span className="pw-account-connected-login">@{profile.github_login}</span>
            </div>
            <Badge variant="success" pill>
              {t("connected.connectedBadge")}
            </Badge>
          </div>
        </Card>
      </section>

      <section
        className="pw-account-settings-section"
        aria-labelledby="pw-account-workspaces-title"
      >
        <h2 id="pw-account-workspaces-title" className="pw-account-settings-section-title">
          {t("workspaces.title")}
        </h2>

        <Card>
          {workspaces.map((workspace) => {
            const isActive = workspace.id === workspaceId;
            const switching = switchingId === workspace.id;

            return (
              <div key={workspace.id} className="pw-account-workspace-row">
                <div className="pw-account-workspace-meta">
                  <span className="pw-account-workspace-name">{workspace.name}</span>
                  <span className="pw-account-workspace-slug">{workspace.slug}</span>
                </div>
                <div className="pw-account-workspace-actions">
                  <Badge variant={ROLE_BADGE_VARIANT[workspace.role]} pill>
                    {roleLabel(workspace.role)}
                  </Badge>
                  {isActive ? (
                    <Badge variant="outline" pill>
                      {t("workspaces.activeBadge")}
                    </Badge>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={switching}
                      disabled={switchingId !== null}
                      onClick={() => {
                        void handleSwitchWorkspace(workspace.id, workspace.slug);
                      }}
                    >
                      {t("workspaces.switch")}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      </section>

      <section
        className="pw-account-settings-section"
        aria-labelledby="pw-account-sessions-title"
      >
        <h2 id="pw-account-sessions-title" className="pw-account-settings-section-title">
          {t("sessions.title")}
        </h2>

        <Card
          title={t("sessions.cardTitle")}
          actions={
            <Button
              variant="secondary"
              size="sm"
              loading={loggingOutAll}
              disabled={loggingOutAll}
              onClick={() => {
                void handleLogoutAll();
              }}
            >
              {t("sessions.logoutEverywhere")}
            </Button>
          }
        >
          <p className="pw-account-sessions-copy">{t("sessions.description")}</p>
        </Card>
      </section>

      <DangerZone id="pw-account-danger-zone" title={tUi("dangerZone.title")}>
        <DangerZoneItem
          title={t("danger.deleteTitle")}
          description={t("danger.deleteDescription")}
          action={
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setDeleteOpen(true);
              }}
            >
              {t("danger.deleteButton")}
            </Button>
          }
        />
      </DangerZone>

      <TypedConfirmDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
        }}
        onConfirm={() => {
          void handleDeleteAccount();
        }}
        title={t("danger.deleteConfirmTitle")}
        description={t("danger.deleteConfirmDescription")}
        confirmLabel={t("danger.deleteConfirmLabel")}
        cancelLabel={tUi("typedConfirm.cancel")}
        expectedPhrase={deleteConfirmPhrase}
        closeAriaLabel={tUi("dialog.closeAriaLabel")}
        phraseLabel={
          <>
            {tUi("typedConfirm.phrasePrefix")}{" "}
            <strong className="pw-typed-confirm-phrase">{deleteConfirmPhrase}</strong>{" "}
            {tUi("typedConfirm.phraseSuffix")}
          </>
        }
        loading={deleting}
      />
    </div>
  );
}
