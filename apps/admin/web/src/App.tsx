import { Navigate, Route, Routes } from "react-router-dom";

import { AdminLayout } from "./components/AdminLayout.js";
import { RequireRole } from "./components/RequireRole.js";
import { useAuth } from "./hooks/use-auth.js";
import { AdminUsersPage } from "./pages/AdminUsersPage.js";
import { InstallationsPage } from "./pages/InstallationsPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { WebhookHealthPage } from "./pages/WebhookHealthPage.js";
import { WorkspacesPage } from "./pages/WorkspacesPage.js";

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="admin-loading-screen">
        <p>Loading session…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="/webhooks" replace />} />
        <Route path="webhooks" element={<WebhookHealthPage />} />
        <Route path="workspaces" element={<WorkspacesPage />} />
        <Route path="installations" element={<InstallationsPage />} />
        <Route
          path="users"
          element={
            <RequireRole minimum="platform_admin">
              <AdminUsersPage />
            </RequireRole>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/webhooks" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
}
