import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './authStore';

/** Wraps authenticated routes; redirects to /login when no access token is in the store. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

/**
 * Restricts a route to users that hold at least one of the given roles.
 * Bounces to /agenda if the user is signed in but lacks the role — keeps the
 * UX simple (no naked 403 page) while still preventing access. Backend
 * remains the source of truth: protected endpoints reject the call anyway,
 * this just hides the screen from people who shouldn't see it.
 */
export function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);
  const userRoles = useAuthStore((s) => s.user?.roles ?? []);
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  const allowed = roles.some((r) => userRoles.includes(r));
  if (!allowed) {
    return <Navigate to="/agenda" replace />;
  }
  return <>{children}</>;
}

/**
 * Restricts a route to users that hold the given permission code.
 * Bounces to /agenda when missing, /login when not authenticated.
 * QA3-3 v1: enforced at frontend only — backend hot path still uses
 * hardcoded role checks.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);
  const userPerms = useAuthStore((s) => s.user?.permissions);
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  // Backward-compat: legacy sessions (`/users/me` not yet returning
  // permissions) keep the old role-based behaviour. The check kicks in only
  // once the backend starts populating the field.
  if (userPerms != null && !userPerms.includes(permission)) {
    // Pick a safe fallback so we don't infinite-loop when the redirect
    // target itself requires a permission the user doesn't have. /agenda is
    // the default landing page; if the user lacks even APPOINTMENT_READ,
    // bounce to /login (force re-auth).
    const fallback = userPerms.includes('APPOINTMENT_READ') ? '/agenda' : '/login';
    if (fallback === location.pathname) {
      return <>{children}</>; // shouldn't happen but guard against the loop anyway
    }
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
}

/** For /login and /onboarding — if you're already authenticated, bounce to /agenda. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);
  if (isAuthenticated) return <Navigate to="/agenda" replace />;
  return <>{children}</>;
}
