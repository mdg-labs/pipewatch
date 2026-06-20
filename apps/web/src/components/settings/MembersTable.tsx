"use client";

import type { UpdateWorkspaceMemberInput, WorkspaceMember, WorkspaceRole } from "@pipewatch/types";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Avatar,
  Badge,
  Button,
  Dialog,
  EmptyState,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pipewatch/ui";

import { ErrorRetry } from "@/components/ErrorRetry";
import { TableSkeleton } from "@/components/TableSkeleton";
import { useApi } from "@/hooks/use-api";
import { useWorkspaceRole } from "@/hooks/use-workspace-role";
import { useToast } from "@/providers/ToastProvider";

import {
  InviteMemberModal,
  type CreateWorkspaceInviteInput,
  type WorkspaceInvite,
} from "./InviteMemberModal";
import "./members-settings.css";

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

const ROLE_OPTIONS: Array<{ value: WorkspaceRole; label: string }> = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
  { value: "owner", label: "Owner" },
];

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
}

function memberDisplayName(member: WorkspaceMember): string {
  return member.name?.trim() || member.email || "Unknown member";
}

type ConfirmAction =
  | { kind: "remove"; member: WorkspaceMember }
  | { kind: "leave" }
  | { kind: "revoke"; invite: WorkspaceInvite };

/** B9 members settings — active members, pending invites, invite modal. */
export function MembersTable() {
  const router = useRouter();
  const { workspace, workspaceId, claims, workspaces } = useApi();
  const { canMutate, readOnly } = useWorkspaceRole();
  const { toast } = useToast();
  const tUi = useTranslations("ui");

  const currentUserId = claims?.sub ?? null;

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<WorkspaceMember | null>(null);
  const [roleValue, setRoleValue] = useState<WorkspaceRole>("member");
  const [roleSaving, setRoleSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const ownerCount = useMemo(
    () => members.filter((member) => member.role === "owner").length,
    [members],
  );

  const currentMember = useMemo(
    () => members.find((member) => member.user_id === currentUserId) ?? null,
    [currentUserId, members],
  );

  const isSoleOwner =
    currentMember?.role === "owner" && ownerCount <= 1;

  const loadData = useCallback(async () => {
    if (!workspace) {
      setLoading(false);
      setLoadError(true);
      return;
    }

    setLoading(true);
    setLoadError(false);

    try {
      const membersData = await workspace.get<WorkspaceMember[]>("/members");
      setMembers(membersData);

      if (canMutate) {
        try {
          const invitesData = await workspace.get<WorkspaceInvite[]>("/invites");
          setInvites(invitesData);
        } catch {
          setInvites([]);
        }
      } else {
        setInvites([]);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [canMutate, workspaceId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleInvite = useCallback(
    async (input: CreateWorkspaceInviteInput) => {
      if (!workspace) {
        throw new Error("Workspace unavailable");
      }

      const invite = await workspace.post<WorkspaceInvite>("/invites", input);
      setInvites((current) => [invite, ...current]);
      return invite;
    },
    [workspaceId],
  );

  const openRoleDialog = useCallback((member: WorkspaceMember) => {
    setRoleTarget(member);
    setRoleValue(member.role);
  }, []);

  const handleRoleSave = useCallback(async () => {
    if (!workspace || !roleTarget || roleValue === roleTarget.role) {
      setRoleTarget(null);
      return;
    }

    setRoleSaving(true);
    try {
      const body: UpdateWorkspaceMemberInput = { role: roleValue };
      const updated = await workspace.patch<WorkspaceMember>(
        `/members/${roleTarget.user_id}`,
        body,
      );
      setMembers((current) =>
        current.map((member) =>
          member.user_id === updated.user_id ? updated : member,
        ),
      );
      toast({
        title: "Role updated",
        variant: "success",
      });
      setRoleTarget(null);
    } catch {
      toast({
        title: "Could not update role",
        description: "You may not demote the last owner.",
        variant: "error",
      });
    } finally {
      setRoleSaving(false);
    }
  }, [roleTarget, roleValue, toast, workspaceId]);

  const handleConfirm = useCallback(async () => {
    if (!workspace || !confirmAction) {
      return;
    }

    setConfirmLoading(true);
    try {
      if (confirmAction.kind === "remove") {
        await workspace.delete(`/members/${confirmAction.member.user_id}`);
        setMembers((current) =>
          current.filter((member) => member.user_id !== confirmAction.member.user_id),
        );
        toast({ title: "Member removed", variant: "success" });
      } else if (confirmAction.kind === "leave") {
        if (!currentUserId) {
          return;
        }
        await workspace.delete(`/members/${currentUserId}`);
        toast({ title: "You left the workspace", variant: "success" });
        const fallback = workspaces.find((item) => item.id !== workspaceId);
        if (fallback) {
          router.replace(`/workspaces/${fallback.slug}`);
        } else {
          router.replace("/");
        }
      } else {
        await workspace.delete(`/invites/${confirmAction.invite.id}`);
        setInvites((current) =>
          current.filter((invite) => invite.id !== confirmAction.invite.id),
        );
        toast({ title: "Invite revoked", variant: "success" });
      }
      setConfirmAction(null);
    } catch {
      toast({
        title:
          confirmAction.kind === "leave"
            ? "Could not leave workspace"
            : confirmAction.kind === "remove"
              ? "Could not remove member"
              : "Could not revoke invite",
        variant: "error",
      });
    } finally {
      setConfirmLoading(false);
    }
  }, [confirmAction, currentUserId, router, toast, workspaceId, workspaces]);

  const handleResend = useCallback(
    async (invite: WorkspaceInvite) => {
      if (!workspace) {
        return;
      }

      setResendingId(invite.id);
      try {
        const updated = await workspace.post<WorkspaceInvite>(
          `/invites/${invite.id}/resend`,
        );
        setInvites((current) =>
          current.map((row) => (row.id === updated.id ? updated : row)),
        );
        toast({
          title: updated.email_sent ? "Invite resent" : "Invite link refreshed",
          ...(updated.invite_url ? { description: updated.invite_url } : {}),
          variant: "success",
        });
      } catch {
        toast({
          title: "Could not resend invite",
          variant: "error",
        });
      } finally {
        setResendingId(null);
      }
    },
    [toast, workspaceId],
  );

  if (loading) {
    return (
      <div className="pw-members-settings">
        <TableSkeleton columns={6} rows={4} />
      </div>
    );
  }

  if (loadError) {
    return (
      <ErrorRetry
        message="We could not load workspace members. Check your connection and try again."
        onRetry={() => {
          void loadData();
        }}
      />
    );
  }

  const confirmTitle = (() => {
    if (!confirmAction) {
      return "";
    }
    if (confirmAction.kind === "leave") {
      return "Leave workspace";
    }
    if (confirmAction.kind === "remove") {
      return "Remove member";
    }
    return "Revoke invite";
  })();

  const confirmDescription = (() => {
    if (!confirmAction) {
      return "";
    }
    if (confirmAction.kind === "leave") {
      return "You will lose access to this workspace and its pipeline data.";
    }
    if (confirmAction.kind === "remove") {
      return `${memberDisplayName(confirmAction.member)} will lose access to this workspace.`;
    }
    return `${confirmAction.invite.email} will no longer be able to accept this invitation.`;
  })();

  return (
    <div className="pw-members-settings">
      <header className="pw-members-settings-header">
        <div>
          <h1>Members</h1>
          <p>Manage who has access to this workspace.</p>
        </div>
        {canMutate ? (
          <Button
            onClick={() => {
              setInviteOpen(true);
            }}
          >
            Invite member
          </Button>
        ) : null}
      </header>

      <section className="pw-members-section" aria-labelledby="pw-members-active-title">
        <h2 id="pw-members-active-title" className="pw-members-section-title">
          Active members
        </h2>

        {members.length === 0 ? (
          <EmptyState
            title="No members yet"
            description="Invite teammates to collaborate on pipeline visibility."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead align="right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const isSelf = member.user_id === currentUserId;
                const showAdminActions = canMutate && !isSelf;

                return (
                  <TableRow key={member.user_id}>
                    <TableCell>
                      <div className="pw-members-member-cell">
                        <Avatar
                          {...(member.avatar_url ? { src: member.avatar_url } : {})}
                          name={memberDisplayName(member)}
                          size="sm"
                        />
                        <div className="pw-members-member-meta">
                          <span className="pw-members-member-name">
                            {memberDisplayName(member)}
                            {isSelf ? (
                              <Badge variant="outline" pill className="pw-members-you-badge">
                                You
                              </Badge>
                            ) : null}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{member.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={ROLE_BADGE_VARIANT[member.role]} pill>
                        {ROLE_LABELS[member.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(member.joined_at)}</TableCell>
                    <TableCell align="right">
                      <div className="pw-members-actions">
                        {isSelf ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={isSoleOwner}
                            onClick={() => {
                              setConfirmAction({ kind: "leave" });
                            }}
                          >
                            Leave workspace
                          </Button>
                        ) : null}
                        {showAdminActions ? (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                openRoleDialog(member);
                              }}
                            >
                              Change role
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => {
                                setConfirmAction({ kind: "remove", member });
                              }}
                            >
                              Remove
                            </Button>
                          </>
                        ) : null}
                        {readOnly && !isSelf ? (
                          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                            —
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>

      {canMutate ? (
        <section className="pw-members-section" aria-labelledby="pw-members-pending-title">
          <h2 id="pw-members-pending-title" className="pw-members-section-title">
            Pending invites
          </h2>

          {invites.length === 0 ? (
            <p className="pw-members-empty">No pending invitations.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invited</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead align="right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell>{invite.email}</TableCell>
                    <TableCell>
                      <Badge variant={ROLE_BADGE_VARIANT[invite.role]} pill>
                        {ROLE_LABELS[invite.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(invite.invited_at)}</TableCell>
                    <TableCell>{formatDate(invite.expires_at)}</TableCell>
                    <TableCell align="right">
                      <div className="pw-members-actions">
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={resendingId === invite.id}
                          disabled={resendingId === invite.id}
                          onClick={() => {
                            void handleResend(invite);
                          }}
                        >
                          Resend
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            setConfirmAction({ kind: "revoke", invite });
                          }}
                        >
                          Revoke
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      ) : null}

      <InviteMemberModal
        open={inviteOpen}
        onClose={() => {
          setInviteOpen(false);
        }}
        onInvite={handleInvite}
      />

      <Dialog
        open={roleTarget !== null}
        onClose={() => {
          if (!roleSaving) {
            setRoleTarget(null);
          }
        }}
        closeAriaLabel={tUi("dialog.closeAriaLabel")}
        title="Change member role"
        {...(roleTarget
          ? { description: `Update the role for ${memberDisplayName(roleTarget)}.` }
          : {})}
        size="sm"
        footer={
          <div className="pw-members-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setRoleTarget(null);
              }}
              disabled={roleSaving}
            >
              Cancel
            </Button>
            <Button
              loading={roleSaving}
              disabled={roleSaving || roleTarget?.role === roleValue}
              onClick={() => {
                void handleRoleSave();
              }}
            >
              Save role
            </Button>
          </div>
        }
      >
        <div className="pw-members-role-dialog-body">
          <Select
            label="Role"
            value={roleValue}
            onChange={(value) => {
              setRoleValue(value as WorkspaceRole);
            }}
            options={ROLE_OPTIONS}
          />
        </div>
      </Dialog>

      <Dialog
        open={confirmAction !== null}
        onClose={() => {
          if (!confirmLoading) {
            setConfirmAction(null);
          }
        }}
        closeAriaLabel={tUi("dialog.closeAriaLabel")}
        title={confirmTitle}
        description={confirmDescription}
        size="sm"
        footer={
          <div className="pw-members-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setConfirmAction(null);
              }}
              disabled={confirmLoading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={confirmLoading}
              disabled={confirmLoading}
              onClick={() => {
                void handleConfirm();
              }}
            >
              Confirm
            </Button>
          </div>
        }
      />
    </div>
  );
}
