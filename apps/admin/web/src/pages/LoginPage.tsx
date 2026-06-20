import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";

import { Button, Card, Input } from "@pipewatch/ui";

import { useAuth } from "../hooks/use-auth.js";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/webhooks" replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await login(email, password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-login">
      <Card className="admin-login-card">
        <h1>PipeWatch Admin</h1>
        <p className="admin-muted">Sign in with your platform operator account.</p>
        <form className="admin-login-form" onSubmit={(event) => void handleSubmit(event)}>
          <Input
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error ? (
            <p className="admin-inline-error" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" loading={submitting} disabled={loading}>
            Sign in
          </Button>
        </form>
      </Card>
    </div>
  );
}
