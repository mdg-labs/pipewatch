"use client";

import type { CreateApiKeyInput, CreatedApiKey } from "@pipewatch/types";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Button, Dialog, Input } from "@pipewatch/ui";

import { useToast } from "@/providers/ToastProvider";

import "./members-settings.css";

export type CreateApiKeyModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CreateApiKeyInput) => Promise<CreatedApiKey>;
};

function toExpiresAtIso(dateValue: string): string {
  return new Date(`${dateValue}T23:59:59`).toISOString();
}

/** B11 create API key modal — form then one-time full key reveal. */
export function CreateApiKeyModal({ open, onClose, onCreate }: CreateApiKeyModalProps) {
  const { toast } = useToast();
  const tUi = useTranslations("ui");
  const [name, setName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setExpiryDate("");
      setSubmitting(false);
      setCreated(null);
      setCopied(false);
    }
  }, [open]);

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    setSubmitting(true);
    try {
      const input: CreateApiKeyInput = { name: trimmed };
      if (expiryDate) {
        input.expires_at = toExpiresAtIso(expiryDate);
      }

      const result = await onCreate(input);
      setCreated(result);
    } catch {
      toast({
        title: "Could not create API key",
        description: "Check the name and expiry date, then try again.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }, [expiryDate, name, onCreate, toast]);

  const handleCopyKey = useCallback(async () => {
    if (!created?.key) {
      return;
    }

    try {
      await navigator.clipboard.writeText(created.key);
      setCopied(true);
      toast({
        title: "API key copied",
        variant: "success",
      });
    } catch {
      toast({
        title: "Could not copy key",
        variant: "error",
      });
    }
  }, [created?.key, toast]);

  const handleDone = useCallback(() => {
    onClose();
  }, [onClose]);

  if (created) {
    return (
      <Dialog
        open={open}
        title="API key created"
        description="Copy this key now. It won't be shown again."
        size="md"
        footer={
          <Button onClick={handleDone}>Done</Button>
        }
      >
        <div className="pw-members-role-dialog-body">
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 500,
                color: "var(--text-tertiary)",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Your new API key
            </p>
            <div
              style={{
                marginTop: 8,
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <p className="pw-members-invite-link" style={{ flex: 1, marginTop: 0 }}>
                {created.key}
              </p>
              <Button variant="secondary" size="sm" onClick={() => void handleCopyKey()}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          <p
            style={{
              margin: 0,
              padding: "10px 12px",
              borderRadius: 6,
              background: "oklch(70% 0.195 55 / 0.06)",
              border: "1px solid oklch(70% 0.195 55 / 0.22)",
              fontSize: 12,
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            Store this key securely. PipeWatch cannot recover it if lost.
          </p>

          <Input label="Key name" value={created.name} disabled />
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      closeAriaLabel={tUi("dialog.closeAriaLabel")}
      title="Create API key"
      description="Name your key and optionally set an expiry date."
      size="sm"
      footer={
        <div className="pw-members-actions">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            loading={submitting}
            disabled={submitting || name.trim().length === 0}
            onClick={() => void handleSubmit()}
          >
            Create key
          </Button>
        </div>
      }
    >
      <div className="pw-members-role-dialog-body">
        <Input
          label="Name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder="CI pipeline"
          autoComplete="off"
        />
        <Input
          label="Expiry date (optional)"
          type="date"
          value={expiryDate}
          onChange={(event) => {
            setExpiryDate(event.target.value);
          }}
          hint="Leave blank for a key that never expires."
        />
      </div>
    </Dialog>
  );
}
