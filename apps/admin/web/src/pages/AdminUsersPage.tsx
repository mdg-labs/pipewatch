import { useState, type FormEvent } from "react";

import { Button, Card, DataTable, Input, Select } from "@pipewatch/ui";

import { apiFetch } from "../api/client.js";
import type { AdminInvite, AdminRole } from "../api/types.js";
import { formatDateTime } from "../lib/format.js";
import { formatAdminRole } from "../lib/roles.js";
import {
  AsyncBoundary,
  TableSkeleton,
} from "../components/AsyncBoundary.js";
import { useApiQuery } from "../hooks/use-api-query.js";

const ROLE_OPTIONS: { value: AdminRole; label: string }[] = [
  { value: "viewer", label: "Viewer" },
  { value: "operator", label: "Operator" },
  { value: "platform_admin", label: "Platform admin" },
];

export function AdminUsersPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("viewer");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const invitesQuery = useApiQuery(
    () => apiFetch<AdminInvite[]>("/api/admin/invites"),
    [reloadToken],
  );

  const handleCreateInvite = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      await apiFetch<AdminInvite>("/api/admin/invites", {
        method: "POST",
        body: JSON.stringify({ email, role }),
      });
      setEmail("");
      setRole("viewer");
      setReloadToken((value) => value + 1);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Invite failed");
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      id: "email",
      header: "Email",
      render: (row: AdminInvite) => row.email,
    },
    {
      id: "role",
      header: "Role",
      render: (row: AdminInvite) => formatAdminRole(row.role),
    },
    {
      id: "invitedAt",
      header: "Invited",
      render: (row: AdminInvite) => formatDateTime(row.invited_at),
    },
    {
      id: "expiresAt",
      header: "Expires",
      render: (row: AdminInvite) => formatDateTime(row.expires_at),
    },
    {
      id: "emailSent",
      header: "Email",
      render: (row: AdminInvite) => (row.email_sent ? "Sent" : "Pending"),
    },
  ];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1>Admin users</h1>
        <p className="admin-muted">Pending platform operator invites.</p>
      </header>

      <Card className="admin-form-card">
        <h2 className="admin-card-title">Create invite</h2>
        <form className="admin-invite-form" onSubmit={(event) => void handleCreateInvite(event)}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Select
            label="Role"
            value={role}
            onChange={(value) => setRole(value as AdminRole)}
            options={ROLE_OPTIONS}
          />
          {formError ? (
            <p className="admin-inline-error" role="alert">
              {formError}
            </p>
          ) : null}
          <Button type="submit" loading={submitting}>
            Send invite
          </Button>
        </form>
      </Card>

      <Card className="admin-table-card">
        <h2 className="admin-card-title">Pending invites</h2>
        <AsyncBoundary
          loading={invitesQuery.loading}
          error={invitesQuery.error}
          onRetry={invitesQuery.retry}
          skeleton={<TableSkeleton rows={5} />}
        >
          {invitesQuery.data ? (
            <DataTable
              columns={columns}
              rows={invitesQuery.data}
              getRowKey={(row) => row.id}
              emptyState="No pending invites."
            />
          ) : null}
        </AsyncBoundary>
      </Card>
    </div>
  );
}
