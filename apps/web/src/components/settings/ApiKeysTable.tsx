"use client";

import type {
  ApiKeySummary,
  CreateApiKeyInput,
  CreatedApiKey,
  WorkspaceMember,
} from "@pipewatch/types";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Avatar,
  Badge,
  Button,
  Dialog,
  EmptyState,
  Switch,
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
import { ApiClientError } from "@/lib/api-client";
import { API_AUTH_INSTRUCTIONS, getApiDocsUrl } from "@/lib/api-docs";
import { publicApiUrl } from "@/lib/env";
import { useToast } from "@/providers/ToastProvider";

import { CreateApiKeyModal } from "./CreateApiKeyModal";
import "./members-settings.css";

type ApiKeyRow = ApiKeySummary & {
  created_by?: string;
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
}

function formatRelative(
  iso: string | null,
  t: ReturnType<typeof useTranslations<"settings.apiKeys">>,
  tCommon: ReturnType<typeof useTranslations<"common">>,
): string {
  if (!iso) {
    return t("neverUsed");
  }

  const deltaMs = Date.now() - new Date(iso).getTime();
  const deltaMinutes = Math.round(deltaMs / 60_000);

  if (deltaMinutes < 1) {
    return tCommon("relativeTime.justNow");
  }

  if (deltaMinutes < 60) {
    return tCommon("relativeTime.minutesAgo", { count: deltaMinutes });
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return tCommon("relativeTime.hoursAgo", { count: deltaHours });
  }

  const deltaDays = Math.round(deltaHours / 24);
  if (deltaDays < 30) {
    return tCommon("relativeTime.daysAgo", { count: deltaDays });
  }

  return formatDate(iso);
}

function formatExpiry(
  iso: string | null,
  t: ReturnType<typeof useTranslations<"settings.apiKeys">>,
): string {
  if (!iso) {
    return t("noExpiry");
  }

  const expiresAt = new Date(iso);
  const daysUntil = Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000);

  if (daysUntil < 0) {
    return t("expired");
  }

  if (daysUntil <= 14) {
    return t("expiresInDays", { count: daysUntil });
  }

  return formatDate(iso);
}

function formatPrefix(prefix: string): string {
  const visible = prefix.slice(0, 8);
  return prefix.length > 8 ? `${visible}…` : visible;
}

function resolveCreatorLabel(
  key: ApiKeyRow,
  membersById: Map<string, WorkspaceMember>,
  t: ReturnType<typeof useTranslations<"settings.apiKeys">>,
  tCommon: ReturnType<typeof useTranslations<"common">>,
): string {
  if (!key.created_by) {
    return tCommon("emDash");
  }

  const member = membersById.get(key.created_by);
  if (!member) {
    return tCommon("emDash");
  }

  return member.name?.trim() || member.email || t("unknownMember");
}

/** B11 API keys settings — list, create, revoke, show revoked toggle. */
export function ApiKeysTable() {
  const { workspace, claims, workspaceId } = useApi();
  const { canMutate, readOnly } = useWorkspaceRole();
  const { toast } = useToast();
  const t = useTranslations("settings.apiKeys");
  const tCommon = useTranslations("common");
  const tUi = useTranslations("ui");
  const apiDocsUrl = getApiDocsUrl();

  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [showRevoked, setShowRevoked] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);
  const [revokeLoading, setRevokeLoading] = useState(false);

  const membersById = useMemo(
    () => new Map(members.map((member) => [member.user_id, member])),
    [members],
  );

  const visibleKeys = useMemo(() => {
    return keys.filter((key) => showRevoked || key.revoked_at === null);
  }, [keys, showRevoked]);

  const loadData = useCallback(async () => {
    if (!workspace) {
      setLoading(false);
      setLoadError(true);
      return;
    }

    setLoading(true);
    setLoadError(false);
    setForbidden(false);

    try {
      const [keysData, membersData] = await Promise.all([
        workspace.get<ApiKeyRow[]>("/api-keys"),
        workspace.get<WorkspaceMember[]>("/members").catch(() => [] as WorkspaceMember[]),
      ]);
      setKeys(keysData);
      setMembers(membersData);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 403) {
        setForbidden(true);
      } else {
        setLoadError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreate = useCallback(
    async (input: CreateApiKeyInput): Promise<CreatedApiKey> => {
      if (!workspace) {
        throw new Error("workspace_unavailable");
      }

      const created = await workspace.post<CreatedApiKey>("/api-keys", input);
      const summary: ApiKeyRow = {
        id: created.id,
        workspace_id: created.workspace_id,
        name: created.name,
        key_prefix: created.key_prefix,
        expires_at: created.expires_at,
        last_used_at: created.last_used_at,
        revoked_at: created.revoked_at,
        created_at: created.created_at,
        ...(claims?.sub ? { created_by: claims.sub } : {}),
      };
      setKeys((current) => [...current, summary]);
      return created;
    },
    [claims?.sub, workspaceId],
  );

  const handleCopyPrefix = useCallback(
    async (prefix: string) => {
      try {
        await navigator.clipboard.writeText(prefix);
        toast({
          title: t("toast.prefixCopiedTitle"),
          variant: "success",
        });
      } catch {
        toast({
          title: t("toast.prefixCopyErrorTitle"),
          variant: "error",
        });
      }
    },
    [t, toast],
  );

  const handleRevoke = useCallback(async () => {
    if (!workspace || !revokeTarget) {
      return;
    }

    setRevokeLoading(true);
    try {
      await workspace.delete(`/api-keys/${revokeTarget.id}`);
      setKeys((current) =>
        current.map((key) =>
          key.id === revokeTarget.id
            ? { ...key, revoked_at: new Date().toISOString() }
            : key,
        ),
      );
      toast({ title: t("toast.revokedTitle"), variant: "success" });
      setRevokeTarget(null);
    } catch {
      toast({
        title: t("toast.revokeErrorTitle"),
        variant: "error",
      });
    } finally {
      setRevokeLoading(false);
    }
  }, [revokeTarget, t, toast, workspaceId]);

  if (loading) {
    return (
      <div className="pw-members-settings">
        <TableSkeleton columns={7} rows={3} />
      </div>
    );
  }

  if (forbidden) {
    return (
      <section className="pw-members-settings" role="alert">
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{t("title")}</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>{t("forbiddenMessage")}</p>
      </section>
    );
  }

  if (loadError) {
    return (
      <ErrorRetry
        message={t("loadError")}
        onRetry={() => {
          void loadData();
        }}
      />
    );
  }

  return (
    <div className="pw-members-settings">
      <header className="pw-members-settings-header">
        <div>
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
        </div>
        {canMutate ? (
          <Button
            onClick={() => {
              setCreateOpen(true);
            }}
          >
            {t("createButton")}
          </Button>
        ) : null}
      </header>

      {keys.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          actions={
            <div className="pw-members-actions" style={{ justifyContent: "center" }}>
              {canMutate ? (
                <Button
                  onClick={() => {
                    setCreateOpen(true);
                  }}
                >
                  {t("createButton")}
                </Button>
              ) : null}
              <a
                href={apiDocsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 14, fontWeight: 500 }}
              >
                {t("viewApiDocs")}
              </a>
            </div>
          }
        />
      ) : visibleKeys.length === 0 ? (
        <p className="pw-members-empty">{t("noActiveKeys")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.name")}</TableHead>
              <TableHead>{t("columns.prefix")}</TableHead>
              <TableHead>{t("columns.createdBy")}</TableHead>
              <TableHead>{t("columns.created")}</TableHead>
              <TableHead>{t("columns.lastUsed")}</TableHead>
              <TableHead>{t("columns.expires")}</TableHead>
              <TableHead align="right">{t("columns.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleKeys.map((key) => {
              const revoked = key.revoked_at !== null;
              const creator = membersById.get(key.created_by ?? "");
              const creatorLabel = resolveCreatorLabel(key, membersById, t, tCommon);

              return (
                <TableRow key={key.id}>
                  <TableCell>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span>{key.name}</span>
                      {revoked ? (
                        <Badge variant="outline" pill>
                          {t("revokedBadge")}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      title={t("copyPrefixTitle")}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        color: "var(--text-tertiary)",
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-subtle)",
                        padding: "2px 8px",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        void handleCopyPrefix(key.key_prefix);
                      }}
                    >
                      {formatPrefix(key.key_prefix)}
                    </button>
                  </TableCell>
                  <TableCell>
                    {creator ? (
                      <div className="pw-members-member-cell">
                        <Avatar
                          {...(creator.avatar_url ? { src: creator.avatar_url } : {})}
                          name={creatorLabel}
                          size="sm"
                        />
                        <span
                          style={{
                            fontSize: 13,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {creatorLabel}
                        </span>
                      </div>
                    ) : (
                      creatorLabel
                    )}
                  </TableCell>
                  <TableCell>{formatDate(key.created_at)}</TableCell>
                  <TableCell>
                    <span
                      style={
                        key.last_used_at
                          ? undefined
                          : { color: "var(--text-tertiary)", fontStyle: "italic" }
                      }
                    >
                      {formatRelative(key.last_used_at, t, tCommon)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      style={
                        key.expires_at &&
                        new Date(key.expires_at).getTime() - Date.now() <= 14 * 86_400_000
                          ? { color: "var(--status-warning, oklch(75% 0.160 50))", fontWeight: 500 }
                          : undefined
                      }
                    >
                      {formatExpiry(key.expires_at, t)}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    {canMutate && !revoked ? (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setRevokeTarget(key);
                        }}
                      >
                        {t("revokeButton")}
                      </Button>
                    ) : readOnly || revoked ? (
                      <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                        {tCommon("emDash")}
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Switch
        label={t("showRevokedLabel")}
        checked={showRevoked}
        onChange={(checked) => {
          setShowRevoked(checked);
        }}
      />

      {publicApiUrl ? (
        <aside
          style={{
            marginTop: 8,
            padding: 16,
            borderRadius: 8,
            border: "1px solid var(--border-default)",
            background: "var(--bg-surface)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t("docsTitle")}</h2>
          <p style={{ color: "var(--text-secondary)", marginTop: 8, marginBottom: 12 }}>
            {t("docsDescription")}
          </p>
          <p style={{ margin: 0 }}>
            <a href={apiDocsUrl} target="_blank" rel="noopener noreferrer">
              {t("docsLink")}
            </a>
          </p>
          <p
            style={{
              color: "var(--text-secondary)",
              marginTop: 16,
              marginBottom: 8,
              fontSize: 13,
            }}
          >
            {t("authHint")}
          </p>
          <pre
            style={{
              margin: 0,
              padding: 12,
              borderRadius: 6,
              background: "var(--bg-elevated)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              lineHeight: 1.5,
              overflowX: "auto",
            }}
          >
            {`${API_AUTH_INSTRUCTIONS.jwt}\n${API_AUTH_INSTRUCTIONS.apiKey}`}
          </pre>
        </aside>
      ) : null}

      <CreateApiKeyModal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
        }}
        onCreate={handleCreate}
      />

      <Dialog
        open={revokeTarget !== null}
        onClose={() => {
          if (!revokeLoading) {
            setRevokeTarget(null);
          }
        }}
        closeAriaLabel={tUi("dialog.closeAriaLabel")}
        title={t("revokeDialog.title")}
        {...(revokeTarget
          ? {
              description: t("revokeDialog.description", { name: revokeTarget.name }),
            }
          : {})}
        size="sm"
        footer={
          <div className="pw-members-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setRevokeTarget(null);
              }}
              disabled={revokeLoading}
            >
              {tUi("typedConfirm.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={revokeLoading}
              disabled={revokeLoading}
              onClick={() => {
                void handleRevoke();
              }}
            >
              {t("revokeDialog.confirmButton")}
            </Button>
          </div>
        }
      />
    </div>
  );
}
