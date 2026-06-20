import { NavLink, Outlet } from "react-router-dom";

import { Badge, Button, LogoWordmark } from "@pipewatch/ui";

import { useAuth } from "../hooks/use-auth.js";
import { formatAdminRole } from "../lib/roles.js";
import { RequireRole } from "./RequireRole.js";

const NAV_ITEMS = [
  { to: "/webhooks", label: "Webhook health" },
  { to: "/workspaces", label: "Workspaces" },
  { to: "/installations", label: "Installations" },
  { to: "/users", label: "Admin users", minimum: "platform_admin" as const },
];

export function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <LogoWordmark />
          <Badge variant="outline">Admin</Badge>
        </div>
        <nav className="admin-nav" aria-label="Admin navigation">
          {NAV_ITEMS.map((item) => {
            const link = (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? "admin-nav-link admin-nav-link-active" : "admin-nav-link"
                }
              >
                {item.label}
              </NavLink>
            );

            if (item.minimum) {
              return (
                <RequireRole key={item.to} minimum={item.minimum}>
                  {link}
                </RequireRole>
              );
            }

            return link;
          })}
        </nav>
        <div className="admin-sidebar-footer">
          {user ? (
            <>
              <p className="admin-user-email">{user.email}</p>
              <p className="admin-user-role">{formatAdminRole(user.role)}</p>
            </>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
