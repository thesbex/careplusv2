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

/** For /login and /onboarding — if you're already authenticated, bounce to /agenda. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);
  if (isAuthenticated) return <Navigate to="/agenda" replace />;
  return <>{children}</>;
}
