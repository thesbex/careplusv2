import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './authStore';

/**
 * Référence stable pour le défaut "rôles non chargés". Sans ça, le selector
 * `(s) => s.user?.roles ?? []` retourne un nouveau tableau à chaque rendu,
 * zustand considère que le state a changé (Object.is(prev, next) = false),
 * re-render, nouveau tableau vide, re-render… "Maximum update depth exceeded"
 * (bug observé 2026-05-09).
 */
const EMPTY_STRING_ARRAY: readonly string[] = Object.freeze([]);

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
  const userRoles = useAuthStore((s) => s.user?.roles) ?? EMPTY_STRING_ARRAY;
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
 * Bounces to a role-appropriate landing page when missing.
 * QA3-3 v1: enforced at frontend only — backend hot path still uses
 * hardcoded role checks.
 *
 * Bug 2026-05-09 : avant on bouncait vers /login si pas APPOINTMENT_READ,
 * mais /login → GuestOnly → /agenda → RequirePermission → /login = infinite
 * loop pour les rôles spécialisés sans APPOINTMENT_READ (LAB, RADIO). Fix :
 * piquer un landing rôle-aware ; si toujours pas de fallback sûr, rendre un
 * écran "Accès refusé" inline plutôt que de boucler.
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
  const userRoles = useAuthStore((s) => s.user?.roles) ?? EMPTY_STRING_ARRAY;
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  // Backward-compat: legacy sessions (`/users/me` not yet returning
  // permissions) keep the old role-based behaviour. The check kicks in only
  // once the backend starts populating the field.
  if (userPerms != null && !userPerms.includes(permission)) {
    const fallback = pickRoleLandingPage(userRoles, userPerms);
    if (fallback === null || fallback === location.pathname) {
      return <AccessDenied />;
    }
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
}

/**
 * Choisit un landing page sûr selon le rôle de l'utilisateur. Renvoie null si
 * aucun landing standard n'est applicable (l'appelant rend alors un écran
 * "Accès refusé" inline pour éviter une boucle de redirection).
 */
function pickRoleLandingPage(roles: readonly string[], perms: readonly string[]): string | null {
  if (roles.includes('LAB')) return '/queue/lab';
  if (roles.includes('RADIO')) return '/queue/radio';
  if (perms.includes('APPOINTMENT_READ')) return '/agenda';
  return null;
}

function AccessDenied() {
  return (
    <div
      role="alert"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 32,
        textAlign: 'center',
        color: 'var(--ink-2)',
      }}
    >
      <strong style={{ fontSize: 16 }}>Accès refusé</strong>
      <span style={{ fontSize: 13, color: 'var(--ink-3)', maxWidth: 360 }}>
        Votre compte n'a pas les autorisations nécessaires pour cette page. Si
        vous pensez qu'il s'agit d'une erreur, contactez l'administrateur du
        cabinet.
      </span>
    </div>
  );
}

/** For /login and /onboarding — if you're already authenticated, bounce to /agenda. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);
  if (isAuthenticated) return <Navigate to="/agenda" replace />;
  return <>{children}</>;
}
