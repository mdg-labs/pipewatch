"use client";

import type { WorkspaceRole } from "@pipewatch/types";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, Dialog, Input, Select } from "@pipewatch/ui";

import { useToast } from "@/providers/ToastProvider";

import "./members-settings.css";

export type WorkspaceInvite = {
  id: string;
  email: string;
  role: WorkspaceRole;
  invited_at: string;
  expires_at: string;
  email_sent: boolean;
  invite_url?: string;
};

export type CreateWorkspaceInviteInput = {
  email: string;
  role: WorkspaceRole;
};

export type InviteMemberModalProps = {
  open: boolean;
  onClose: () => void;
  onInvite(input: CreateWorkspaceInviteInput): Promise<WorkspaceInvite>;
};

export function InviteMemberModal({ open, onClose, onInvite }: InviteMemberModalProps) {
  const { toast } = useToast();
  const t = useTranslations("settings.members.inviteModal");
  const tToast = useTranslations("settings.members.toast");
  const tRoles = useTranslations("invite.roles");
  const tUi = useTranslations("ui");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [submitting, setSubmitting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const roleOptions = useMemo(
    (): Array<{ value: WorkspaceRole; label: string }> => [
      { value: "member", label: tRoles("member") },
      { value: "admin", label: tRoles("admin") },
      { value: "owner", label: tRoles("owner") },
    ],
    [tRoles],
  );

  useEffect(() => {
    if (!open) {
      setEmail("");
      setRole("member");
      setInviteUrl(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      return;
    }

    setSubmitting(true);
    try {
      const invite = await onInvite({ email: trimmed, role });
      toast({
        title: invite.email_sent ? tToast("inviteSentTitle") : tToast("inviteCreatedTitle"),
        description: invite.email_sent
          ? tToast("inviteSentDescription", { email: invite.email })
          : tToast("inviteCreatedDescription"),
        variant: "success",
      });
      if (invite.invite_url) {
        setInviteUrl(invite.invite_url);
      } else {
        onClose();
      }
    } catch {
      toast({
        title: tToast("inviteSendErrorTitle"),
        description: tToast("inviteSendErrorDescription"),
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }, [email, onClose, onInvite, role, tToast, toast]);

  const handleCopyLink = useCallback(async () => {
    if (!inviteUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast({
        title: tToast("inviteLinkCopiedTitle"),
        variant: "success",
      });
      onClose();
    } catch {
      toast({
        title: tToast("inviteLinkCopyErrorTitle"),
        variant: "error",
      });
    }
  }, [inviteUrl, onClose, tToast, toast]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      closeAriaLabel={tUi("dialog.closeAriaLabel")}
      title={t("title")}
      description={t("description")}
      size="sm"
      footer={
        inviteUrl ? (
          <div className="pw-members-actions">
            <Button variant="secondary" onClick={onClose}>
              {t("close")}
            </Button>
            <Button onClick={() => void handleCopyLink()}>{t("copyInviteLink")}</Button>
          </div>
        ) : (
          <div className="pw-members-actions">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              {tUi("typedConfirm.cancel")}
            </Button>
            <Button
              loading={submitting}
              disabled={submitting || email.trim().length === 0}
              onClick={() => void handleSubmit()}
            >
              {t("sendInvite")}
            </Button>
          </div>
        )
      }
    >
      {inviteUrl ? (
        <div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>
            {t("linkHint")}
          </p>
          <p className="pw-members-invite-link">{inviteUrl}</p>
        </div>
      ) : (
        <>
          <Input
            label={t("emailLabel")}
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
          />
          <Select
            label={t("roleLabel")}
            value={role}
            onChange={(value) => {
              setRole(value as WorkspaceRole);
            }}
            options={roleOptions}
          />
        </>
      )}
    </Dialog>
  );
}
