import type { SidebarScreen } from '@/components/shell/Sidebar';

/**
 * Single source of truth for the sidebar item ↔ route path mapping.
 * Used by AppLayout to derive the active sidebar item from the current URL,
 * and to translate sidebar clicks into router navigations.
 *
 * Avant : ce mapping était dupliqué dans 14 pages (chacune redéclarait son
 * `NAV_MAP`). Centraliser ici a deux avantages : (1) le sidebar mounte une
 * seule fois (refacto AppLayout) et n'a plus besoin que chaque page passe
 * `onNavigate` ; (2) ajouter une route ne suppose plus de toucher 14 fichiers.
 */
export const NAV_MAP: Record<SidebarScreen, string> = {
  dashboard: '/dashboard',
  agenda: '/agenda',
  patients: '/patients',
  salle: '/salle',
  consult: '/consultations',
  factu: '/facturation',
  vaccinations: '/vaccinations',
  grossesses: '/grossesses',
  stock: '/stock',
  queueLab: '/queue/lab',
  queueRadio: '/queue/radio',
  messages: '/messages',
  catalogue: '/catalogue',
  params: '/parametres',
};

/**
 * Reverse lookup : pathname → sidebar item to highlight.
 * Greedy on the longest matching prefix so /patients/abc-123 → 'patients',
 * /stock/articles/x → 'stock', /queue/lab → 'queueLab'.
 *
 * Returns undefined for paths that don't map to any sidebar item (e.g. the
 * landing page, login, onboarding, profil) — the layout then renders the
 * sidebar with no item highlighted, which is the expected UX.
 */
export function pathToSidebarScreen(pathname: string): SidebarScreen | undefined {
  // Exact-equal short-circuit (covers /dashboard, /agenda, /salle…).
  const direct = (Object.entries(NAV_MAP) as [SidebarScreen, string][]).find(
    ([, p]) => p === pathname,
  );
  if (direct) return direct[0];

  // Prefix match — picks the longest path that the URL starts with.
  const sortedByLength = (Object.entries(NAV_MAP) as [SidebarScreen, string][]).sort(
    (a, b) => b[1].length - a[1].length,
  );
  for (const [screen, path] of sortedByLength) {
    if (pathname === path || pathname.startsWith(`${path}/`)) return screen;
  }
  return undefined;
}
