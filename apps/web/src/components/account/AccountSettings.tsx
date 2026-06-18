"use client";

import type { UpdateUserProfileInput, UserProfile, WorkspaceRole } from "@pipewatch/types";
import { Github } from "lucide-react";
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

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

const ROLE_BADGE_VARIANT = {
  owner: "accent",
  admin: "default",
  member: "outline",
} as const;

const DELETE_CONFIRM_PHRASE = "delete my account";

/** Account settings — profile, workspaces, sessions, delete (B13). */
export function AccountSettings() {
  const router = useRouter();
  const { api, workspaceId, workspaces } = useApi();
  const { toast } = useToast();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
        title: "Profile updated",
        variant: "success",
      });
      router.refresh();
    } catch {
      toast({
        title: "Could not update profile",
        description: "Check your connection and try again.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }, [api, hasNameChange, name, profile, router, saving, toast]);

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
            title: "Could not switch workspace",
            description: "Try again or sign in again.",
            variant: "error",
          });
          return;
        }

        toast({
          title: "Workspace switched",
          variant: "success",
        });
        router.push(`/workspaces/${slug}`);
        router.refresh();
      } catch {
        toast({
          title: "Could not switch workspace",
          description: "Try again in a moment.",
          variant: "error",
        });
      } finally {
        setSwitchingId(null);
      }
    },
    [router, switchingId, toast],
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
        title: "Signed out everywhere",
        variant: "success",
      });
      window.location.assign("/sign-in");
    } catch {
      toast({
        title: "Could not sign out everywhere",
        description: "Try again in a moment.",
        variant: "error",
      });
      setLoggingOutAll(false);
    }
  }, [loggingOutAll, toast]);

  const handleDeleteAccount = useCallback(async () => {
    if (!profile || deleting) {
      return;
    }

    setDeleting(true);
    try {
      await api.delete("/users/me");
      clearAccessToken();
      toast({
        title: "Account deleted",
        variant: "success",
      });
      setDeleteOpen(false);
      window.location.assign("/sign-in");
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        toast({
          title: "Cannot delete account",
          description:
            "You are the sole owner of a workspace that still has other members. Transfer ownership or remove members first.",
          variant: "error",
        });
        setDeleteOpen(false);
      } else {
        toast({
          title: "Could not delete account",
          description: "Try again in a moment.",
          variant: "error",
        });
      }
    } finally {
      setDeleting(false);
    }
  }, [api, deleting, profile, toast]);

  if (loading) {
    return <CardSkeleton count={3} />;
  }

  if (loadError || !profile) {
    return (
      <ErrorRetry
        message="We could not load your account settings. Check your connection and try again."
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
        <h1>Account</h1>
        <p>Personal settings across all workspaces.</p>
      </header>

      <section
        className="pw-account-settings-section"
        aria-labelledby="pw-account-profile-title"
      >
        <h2 id="pw-account-profile-title" className="pw-account-settings-section-title">
          Profile
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
              label="Display name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
              autoComplete="name"
            />
            <Input
              label="Email"
              value={profile.email ?? ""}
              disabled
              hint="Managed by GitHub"
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
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </section>

      <section
        className="pw-account-settings-section"
        aria-labelledby="pw-account-connected-title"
      >
        <h2 id="pw-account-connected-title" className="pw-account-settings-section-title">
          Connected accounts
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
                GitHub
              </span>
              <span className="pw-account-connected-login">@{profile.github_login}</span>
            </div>
            <Badge variant="success" pill>
              Connected
            </Badge>
          </div>
        </Card>
      </section>

      <section
        className="pw-account-settings-section"
        aria-labelledby="pw-account-workspaces-title"
      >
        <h2 id="pw-account-workspaces-title" className="pw-account-settings-section-title">
          Workspaces
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
                    {ROLE_LABELS[workspace.role]}
                  </Badge>
                  {isActive ? (
                    <Badge variant="outline" pill>
                      Active
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
                      Switch
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
          Sessions
        </h2>

        <Card
          title="Active sessions"
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
              Log out everywhere
            </Button>
          }
        >
          <p className="pw-account-sessions-copy">
            Revoke all refresh tokens and sign out on every device. Your current
            session will end immediately.
          </p>
        </Card>
      </section>

      <DangerZone id="pw-account-danger-zone">
        <DangerZoneItem
          title="Delete account"
          description="Permanently delete your PipeWatch account and remove your access to all workspaces. This cannot be undone."
          action={
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setDeleteOpen(true);
              }}
            >
              Delete account
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
        title="Delete account"
        description="This permanently deletes your account. You will lose access to all workspaces."
        confirmLabel="Delete account"
        expectedPhrase={DELETE_CONFIRM_PHRASE}
        loading={deleting}
      />
    </div>
  );
}
