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
  onCreate(input: CreateApiKeyInput): Promise<CreatedApiKey>;
};

function toExpiresAtIso(dateValue: string): string {
  return new Date(`${dateValue}T23:59:59`).toISOString();
}

/** B11 create API key modal — form then one-time full key reveal. */
export function CreateApiKeyModal({ open, onClose, onCreate }: CreateApiKeyModalProps) {
  const { toast } = useToast();
  const t = useTranslations("settings.apiKeys.createModal");
  const tToast = useTranslations("settings.apiKeys.toast");
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
        title: tToast("createdErrorTitle"),
        description: tToast("createdErrorDescription"),
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }, [expiryDate, name, onCreate, tToast, toast]);

  const handleCopyKey = useCallback(async () => {
    if (!created?.key) {
      return;
    }

    try {
      await navigator.clipboard.writeText(created.key);
      setCopied(true);
      toast({
        title: tToast("keyCopiedTitle"),
        variant: "success",
      });
    } catch {
      toast({
        title: tToast("keyCopyErrorTitle"),
        variant: "error",
      });
    }
  }, [created?.key, tToast, toast]);

  const handleDone = useCallback(() => {
    onClose();
  }, [onClose]);

  if (created) {
    return (
      <Dialog
        open={open}
        title={t("createdTitle")}
        description={t("createdDescription")}
        size="md"
        footer={
          <Button onClick={handleDone}>{t("done")}</Button>
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
              {t("keyLabel")}
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
                {copied ? t("copied") : t("copy")}
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
            {t("storeSecurely")}
          </p>

          <Input label={t("keyNameLabel")} value={created.name} disabled />
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      closeAriaLabel={tUi("dialog.closeAriaLabel")}
      title={t("title")}
      description={t("description")}
      size="sm"
      footer={
        <div className="pw-members-actions">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {tUi("typedConfirm.cancel")}
          </Button>
          <Button
            loading={submitting}
            disabled={submitting || name.trim().length === 0}
            onClick={() => void handleSubmit()}
          >
            {t("createButton")}
          </Button>
        </div>
      }
    >
      <div className="pw-members-role-dialog-body">
        <Input
          label={t("nameLabel")}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder={t("namePlaceholder")}
          autoComplete="off"
        />
        <Input
          label={t("expiryLabel")}
          type="date"
          value={expiryDate}
          onChange={(event) => {
            setExpiryDate(event.target.value);
          }}
          hint={t("expiryHint")}
        />
      </div>
    </Dialog>
  );
}
