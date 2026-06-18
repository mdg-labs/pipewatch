"use client";

import type {
  ApiKeySummary,
  CreateApiKeyInput,
  CreatedApiKey,
  WorkspaceMember,
} from "@pipewatch/types";
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

function formatRelative(iso: string | null): string {
  if (!iso) {
    return "Never";
  }

  const deltaMs = Date.now() - new Date(iso).getTime();
  const deltaMinutes = Math.round(deltaMs / 60_000);

  if (deltaMinutes < 1) {
    return "Just now";
  }

  if (deltaMinutes < 60) {
    return `${deltaMinutes} min ago`;
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours} hour${deltaHours === 1 ? "" : "s"} ago`;
  }

  const deltaDays = Math.round(deltaHours / 24);
  if (deltaDays < 30) {
    return `${deltaDays} day${deltaDays === 1 ? "" : "s"} ago`;
  }

  return formatDate(iso);
}

function formatExpiry(iso: string | null): string {
  if (!iso) {
    return "No expiry";
  }

  const expiresAt = new Date(iso);
  const daysUntil = Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000);

  if (daysUntil < 0) {
    return "Expired";
  }

  if (daysUntil <= 14) {
    return `in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`;
  }

  return formatDate(iso);
}

function formatPrefix(prefix: string): string {
  const visible = prefix.slice(0, 8);
  return prefix.length > 8 ? `${visible}…` : visible;
}

function memberDisplayName(member: WorkspaceMember): string {
  return member.name?.trim() || member.email || "Unknown member";
}

function resolveCreatorLabel(
  key: ApiKeyRow,
  membersById: Map<string, WorkspaceMember>,
): string {
  if (!key.created_by) {
    return "—";
  }

  const member = membersById.get(key.created_by);
  return member ? memberDisplayName(member) : "—";
}

/** B11 API keys settings — list, create, revoke, show revoked toggle. */
export function ApiKeysTable() {
  const { workspace, claims } = useApi();
  const { canMutate, readOnly } = useWorkspaceRole();
  const { toast } = useToast();
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
  }, [workspace]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreate = useCallback(
    async (input: CreateApiKeyInput): Promise<CreatedApiKey> => {
      if (!workspace) {
        throw new Error("Workspace unavailable");
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
    [claims?.sub, workspace],
  );

  const handleCopyPrefix = useCallback(
    async (prefix: string) => {
      try {
        await navigator.clipboard.writeText(prefix);
        toast({
          title: "Prefix copied",
          variant: "success",
        });
      } catch {
        toast({
          title: "Could not copy prefix",
          variant: "error",
        });
      }
    },
    [toast],
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
      toast({ title: "API key revoked", variant: "success" });
      setRevokeTarget(null);
    } catch {
      toast({
        title: "Could not revoke API key",
        variant: "error",
      });
    } finally {
      setRevokeLoading(false);
    }
  }, [revokeTarget, toast, workspace]);

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
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>API Keys</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
          API keys require workspace admin or owner access.
        </p>
      </section>
    );
  }

  if (loadError) {
    return (
      <ErrorRetry
        message="We could not load API keys. Check your connection and try again."
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
          <h1>API Keys</h1>
          <p>
            Use API keys to access PipeWatch programmatically. Keys are
            workspace-scoped and never shown again after creation.
          </p>
        </div>
        {canMutate ? (
          <Button
            onClick={() => {
              setCreateOpen(true);
            }}
          >
            Create API key
          </Button>
        ) : null}
      </header>

      {keys.length === 0 ? (
        <EmptyState
          title="No API keys yet"
          description="Create a key for CI, scripts, or other programmatic access."
          actions={
            <div className="pw-members-actions" style={{ justifyContent: "center" }}>
              {canMutate ? (
                <Button
                  onClick={() => {
                    setCreateOpen(true);
                  }}
                >
                  Create API key
                </Button>
              ) : null}
              <a
                href={apiDocsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 14, fontWeight: 500 }}
              >
                View API docs
              </a>
            </div>
          }
        />
      ) : visibleKeys.length === 0 ? (
        <p className="pw-members-empty">
          No active API keys. Turn on &ldquo;Show revoked keys&rdquo; to view revoked keys.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Created by</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead align="right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleKeys.map((key) => {
              const revoked = key.revoked_at !== null;
              const creator = membersById.get(key.created_by ?? "");
              const creatorLabel = resolveCreatorLabel(key, membersById);

              return (
                <TableRow key={key.id}>
                  <TableCell>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span>{key.name}</span>
                      {revoked ? (
                        <Badge variant="outline" pill>
                          Revoked
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      title="Copy prefix"
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
                      {formatRelative(key.last_used_at)}
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
                      {formatExpiry(key.expires_at)}
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
                        Revoke
                      </Button>
                    ) : readOnly || revoked ? (
                      <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>—</span>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Switch
        label="Show revoked keys"
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
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>API documentation</h2>
          <p style={{ color: "var(--text-secondary)", marginTop: 8, marginBottom: 12 }}>
            Browse the interactive API reference for endpoint details, schemas, and
            try-it requests.
          </p>
          <p style={{ margin: 0 }}>
            <a href={apiDocsUrl} target="_blank" rel="noopener noreferrer">
              Open API docs
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
            Authenticate requests with a session JWT or a workspace API key:
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
        title="Revoke API key"
        {...(revokeTarget
          ? {
              description: `"${revokeTarget.name}" will stop working immediately. This cannot be undone.`,
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
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={revokeLoading}
              disabled={revokeLoading}
              onClick={() => {
                void handleRevoke();
              }}
            >
              Revoke key
            </Button>
          </div>
        }
      />
    </div>
  );
}
