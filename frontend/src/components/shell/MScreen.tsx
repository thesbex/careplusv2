import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { MTabs, type MTabsProps, type MobileTab } from './MTabs';
import { useSalleBadgeCount } from './useSalleBadgeCount';
import '@/styles/mobile.css';

export interface MScreenProps {
  tab?: MobileTab;
  badges?: MTabsProps['badges'];
  /**
   * Override the default bottom-tab navigation. Rarely needed — when omitted,
   * MScreen routes the 4 primary tabs and sends "Plus" to /parametres (the
   * mobile menu hub). Pages MUST NOT pass a no-op here: that leaves the whole
   * tab bar dead, stranding the user on the screen.
   */
  onTabChange?: MTabsProps['onTabChange'];
  topbar?: ReactNode;
  children: ReactNode;
  fab?: ReactNode;
  noTabs?: boolean;
}

/** Bottom-tab → route map. `menu` ("Plus") opens the /parametres menu hub. */
const TAB_ROUTES: Record<MobileTab, string> = {
  agenda: '/agenda',
  salle: '/salle',
  patients: '/patients',
  factu: '/facturation',
  menu: '/parametres',
};

/**
 * Mobile screen frame: topbar + scrollable body + optional FAB + bottom tab bar.
 * Mirrors design/prototype/mobile/shell.jsx:MScreen.
 *
 * MScreen owns the bottom-tab navigation by default so every mobile screen has a
 * working tab bar. Before this, pages each had to pass their own onTabChange;
 * the ones that forgot (Messages) or passed a no-op (catalogue, prescription
 * PDF) ended up with a completely dead tab bar.
 */
export function MScreen({
  tab = 'agenda',
  badges,
  onTabChange,
  topbar,
  children,
  fab,
  noTabs = false,
}: MScreenProps) {
  const navigate = useNavigate();

  // Salle d'attente badge — souscrit à /api/queue (cache partagé avec
  // useQueue, refetch 15 s). On ne tape pas le réseau si l'appelant a
  // déjà passé un `badges` explicite (ex. SalleAttentePage.mobile.tsx).
  const liveSalle = useSalleBadgeCount(badges === undefined);
  const resolvedBadges =
    badges ?? (liveSalle !== undefined && liveSalle > 0 ? { salle: liveSalle } : {});

  const tabsProps: MTabsProps = {
    active: tab,
    badges: resolvedBadges,
    onTabChange: onTabChange ?? ((next: MobileTab) => navigate(TAB_ROUTES[next])),
  };
  return (
    <div className="cp-mobile">
      {topbar}
      <div className="mb scroll">{children}</div>
      {fab}
      {!noTabs && <MTabs {...tabsProps} />}
    </div>
  );
}
