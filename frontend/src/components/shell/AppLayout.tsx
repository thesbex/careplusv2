import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar, type SidebarProps, type NavScreen } from './Sidebar';
import { PatientSearchSpotlight } from './PatientSearchSpotlight';
import { ScreenProtection } from './ScreenProtection';
import { useSalleBadgeCount } from './useSalleBadgeCount';
import { SpotlightContext } from './spotlightContext';
import { NAV_MAP, pathToSidebarScreen } from '@/lib/router/navMap';
import { useHeartbeat } from '@/features/messages/hooks/useHeartbeat';
import { useAuthStore } from '@/lib/auth/authStore';
import { isPureTech, defaultLandingForTech } from '@/lib/auth/roleHelpers';
import '@/styles/shell.css';

/**
 * Persistent application chrome for every authenticated route.
 *
 * Mounts the <Sidebar> + Spotlight + ⌘K handler ONCE, then renders <Outlet />
 * for the page-specific content. Before this layout existed, every page
 * rendered <Screen> which itself rendered <Sidebar>, so a soft router
 * navigation unmounted/remounted the entire chrome (visible flash + the
 * Sidebar's polling hooks reset their internal state on every page change).
 *
 * Pages still call <Screen active=... title=...> — Screen is now a thin
 * frame that renders just the Topbar + content + optional right panel.
 * The `active` prop is informational; AppLayout derives the active item
 * from the URL via `pathToSidebarScreen`.
 */
export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const active: NavScreen = pathToSidebarScreen(location.pathname) ?? 'agenda';
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Heartbeat présence — POST /chat/heartbeat toutes les 30 s pour maintenir
  // last_seen_at à jour côté serveur. Drive la présence on/away/off.
  useHeartbeat();

  // Cloisonnement RBAC pur-tech : un user LAB / RADIO sans autre rôle ne doit
  // pouvoir naviguer QUE vers /queue/lab|/queue/radio + /messages + /profil.
  // Si une URL hors-scope est saisie, bounce vers sa queue. Empêche la fuite
  // d'accès qui existait avant — Sidebar cache déjà les items, ce guard
  // ferme le verrou côté URL.
  const userRoles = useAuthStore((s) => s.user?.roles);
  const pureTech = isPureTech(userRoles);
  useEffect(() => {
    if (!pureTech) return;
    const allowed = ['/queue/', '/messages', '/profil', '/force-change-password'];
    if (!allowed.some((p) => location.pathname.startsWith(p))) {
      navigate(defaultLandingForTech(userRoles), { replace: true });
    }
  }, [pureTech, userRoles, location.pathname, navigate]);

  // Salle badge — partagé avec useQueue, refetch 15s. Persistent across
  // page nav since AppLayout itself doesn't unmount.
  const liveSalle = useSalleBadgeCount();
  const counts: SidebarProps['counts'] | undefined =
    liveSalle !== undefined ? { salle: liveSalle } : undefined;

  const spotlightCtx = useMemo(
    () => ({ openSpotlight: () => setSearchOpen(true) }),
    [],
  );

  return (
    <SpotlightContext.Provider value={spotlightCtx}>
      <div className="cp-app">
        <Sidebar
          active={active}
          {...(counts !== undefined ? { counts } : {})}
          onNavigate={(id) => navigate(NAV_MAP[id])}
        />
        <div className="cp-main">
          <Outlet />
        </div>
        <PatientSearchSpotlight open={searchOpen} onOpenChange={setSearchOpen} />
        <ScreenProtection />
      </div>
    </SpotlightContext.Provider>
  );
}
