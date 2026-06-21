import { useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { Button, Card, Input, LogoWordmark } from "@pipewatch/ui";

import { apiFetch } from "../api/client.js";
import { useAuth } from "../hooks/use-auth.js";

export function ResetPasswordPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/webhooks" replace />;
  }

  const missingToken = !token;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (missingToken) {
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await apiFetch<void>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      navigate("/login", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reset failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-login">
      <Card className="admin-login-card">
        <div className="admin-login-brand">
          <LogoWordmark markSize={24} />
        </div>
        <h1>Set new password</h1>
        <p className="admin-muted">Choose a new password for your operator account.</p>
        {missingToken ? (
          <div className="admin-inline-error" role="alert">
            <p>Invalid or missing reset link.</p>
            <Link className="admin-auth-link" to="/login">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form className="admin-login-form" onSubmit={(event) => void handleSubmit(event)}>
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />
            {error ? (
              <div className="admin-inline-error" role="alert">
                <p>{error}</p>
                <Link className="admin-auth-link" to="/login">
                  Back to sign in
                </Link>
              </div>
            ) : null}
            <Button type="submit" loading={submitting} disabled={loading}>
              Update password
            </Button>
          </form>
        )}
        {!missingToken && !error ? (
          <p className="admin-auth-footer">
            <Link className="admin-auth-link" to="/login">
              Back to sign in
            </Link>
          </p>
        ) : null}
      </Card>
    </div>
  );
}
