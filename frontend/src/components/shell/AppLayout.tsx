import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar, type SidebarProps, type SidebarScreen } from './Sidebar';
import { PatientSearchSpotlight } from './PatientSearchSpotlight';
import { useSalleBadgeCount } from './useSalleBadgeCount';
import { SpotlightContext } from './spotlightContext';
import { NAV_MAP, pathToSidebarScreen } from '@/lib/router/navMap';
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
  const active: SidebarScreen = pathToSidebarScreen(location.pathname) ?? 'agenda';
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
      </div>
    </SpotlightContext.Provider>
  );
}
