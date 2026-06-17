"use client";

import type { WorkspaceRole } from "@pipewatch/types";
import { useCallback, useEffect, useState } from "react";

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

const ROLE_OPTIONS: Array<{ value: WorkspaceRole; label: string }> = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
  { value: "owner", label: "Owner" },
];

export type InviteMemberModalProps = {
  open: boolean;
  onClose: () => void;
  onInvite: (input: CreateWorkspaceInviteInput) => Promise<WorkspaceInvite>;
};

export function InviteMemberModal({ open, onClose, onInvite }: InviteMemberModalProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [submitting, setSubmitting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

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
        title: invite.email_sent ? "Invite sent" : "Invite created",
        description: invite.email_sent
          ? `An invitation email was sent to ${invite.email}.`
          : "Copy the invite link below — email is not configured.",
        variant: "success",
      });
      if (invite.invite_url) {
        setInviteUrl(invite.invite_url);
      } else {
        onClose();
      }
    } catch {
      toast({
        title: "Could not send invite",
        description: "Check the email address and try again.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }, [email, onClose, onInvite, role, toast]);

  const handleCopyLink = useCallback(async () => {
    if (!inviteUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast({
        title: "Invite link copied",
        variant: "success",
      });
      onClose();
    } catch {
      toast({
        title: "Could not copy link",
        variant: "error",
      });
    }
  }, [inviteUrl, onClose, toast]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Invite member"
      description="Send an email invitation or share a link when SMTP is not configured."
      size="sm"
      footer={
        inviteUrl ? (
          <div className="pw-members-actions">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => void handleCopyLink()}>Copy invite link</Button>
          </div>
        ) : (
          <div className="pw-members-actions">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              loading={submitting}
              disabled={submitting || email.trim().length === 0}
              onClick={() => void handleSubmit()}
            >
              Send invite
            </Button>
          </div>
        )
      }
    >
      {inviteUrl ? (
        <div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>
            Share this link with the invitee. It expires in 7 days.
          </p>
          <p className="pw-members-invite-link">{inviteUrl}</p>
        </div>
      ) : (
        <>
          <Input
            label="Email address"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            autoComplete="email"
            placeholder="colleague@example.com"
          />
          <Select
            label="Role"
            value={role}
            onChange={(value) => {
              setRole(value as WorkspaceRole);
            }}
            options={ROLE_OPTIONS}
          />
        </>
      )}
    </Dialog>
  );
}
