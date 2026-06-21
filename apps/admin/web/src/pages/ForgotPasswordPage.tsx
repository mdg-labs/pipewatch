import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";

import { Button, Card, Input, LogoWordmark } from "@pipewatch/ui";

import { apiFetch } from "../api/client.js";
import { useAuth } from "../hooks/use-auth.js";

type ForgotPasswordResponse = {
  message: string;
};

export function ForgotPasswordPage() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/webhooks" replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await apiFetch<ForgotPasswordResponse>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSuccessMessage(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
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
        <h1>Reset password</h1>
        <p className="admin-muted">
          Enter your operator email and we will send a reset link if an account exists.
        </p>
        {successMessage ? (
          <p className="admin-muted" role="status">
            {successMessage}
          </p>
        ) : (
          <form className="admin-login-form" onSubmit={(event) => void handleSubmit(event)}>
            <Input
              label="Email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            {error ? (
              <p className="admin-inline-error" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" loading={submitting} disabled={loading}>
              Send reset link
            </Button>
          </form>
        )}
        <p className="admin-auth-footer">
          <Link className="admin-auth-link" to="/login">
            Back to sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
