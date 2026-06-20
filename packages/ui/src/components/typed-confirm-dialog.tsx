import type { ReactNode } from "react";
import { useEffect, useId, useMemo, useState } from "react";

import { Button } from "./button.js";
import { Dialog } from "./dialog.js";
import { Input } from "./input.js";

export interface TypedConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  expectedPhrase: string;
  phraseLabel: ReactNode;
  closeAriaLabel: string;
  loading?: boolean;
}

export function isTypedConfirmMatch(
  input: string,
  expectedPhrase: string,
): boolean {
  return input === expectedPhrase;
}

export function TypedConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  expectedPhrase,
  phraseLabel,
  closeAriaLabel,
  loading = false,
}: TypedConfirmDialogProps) {
  const inputId = useId();
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (!open) {
      setConfirmText("");
    }
  }, [open]);

  const confirmed = useMemo(
    () => isTypedConfirmMatch(confirmText, expectedPhrase),
    [confirmText, expectedPhrase],
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      closeAriaLabel={closeAriaLabel}
      {...(description ? { description } : {})}
      size="sm"
      footer={
        <div className="pw-typed-confirm-footer">
          <Button
            variant="danger"
            disabled={!confirmed || loading}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
        </div>
      }
    >
      <div className="pw-typed-confirm-body">
        <label htmlFor={inputId} className="pw-input-label pw-typed-confirm-label">
          {phraseLabel}
        </label>
        <Input
          id={inputId}
          mono
          placeholder={expectedPhrase}
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </Dialog>
  );
}
