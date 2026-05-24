import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MTabs,
  MTechTabs,
  type MTabsProps,
  type MobileTab,
  type TechMobileTab,
} from './MTabs';
import { useSalleBadgeCount } from './useSalleBadgeCount';
import { useChatUnreadCount } from '@/features/messages/hooks/useChatUnreadCount';
import { useAuthStore } from '@/lib/auth/authStore';
import { isPureTech, defaultLandingForTech } from '@/lib/auth/roleHelpers';
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
  const location = useLocation();
  const roles = useAuthStore((s) => s.user?.roles);
  const pureTech = isPureTech(roles);

  // Salle d'attente badge — souscrit à /api/queue (cache partagé avec
  // useQueue, refetch 15 s). On ne tape pas le réseau si l'appelant a
  // déjà passé un `badges` explicite (ex. SalleAttentePage.mobile.tsx).
  // Inutile pour un pure-tech (pas d'onglet Salle dans sa barre).
  const liveSalle = useSalleBadgeCount(badges === undefined && !pureTech);
  const resolvedBadges =
    badges ?? (liveSalle !== undefined && liveSalle > 0 ? { salle: liveSalle } : {});

  // Pure-tech : barre d'onglets dédiée (File / Messages / Profil). On ignore le
  // `onTabChange` de la page (qui pointe vers les routes standard, hors cloister)
  // et on pilote la nav nous-mêmes vers les seules destinations autorisées.
  const techUnread = (useChatUnreadCount(pureTech) ?? 0);
  const techActive: TechMobileTab | undefined = location.pathname.startsWith('/queue')
    ? 'queue'
    : location.pathname.startsWith('/messages')
    ? 'messages'
    : location.pathname.startsWith('/profil')
    ? 'profil'
    : undefined;
  const techNav = (next: TechMobileTab) => {
    if (next === 'queue') navigate(defaultLandingForTech(roles));
    else if (next === 'messages') navigate('/messages');
    else navigate('/profil');
  };

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
      {!noTabs &&
        (pureTech ? (
          <MTechTabs
            {...(techActive !== undefined ? { active: techActive } : {})}
            badges={techUnread > 0 ? { messages: techUnread } : {}}
            onTabChange={techNav}
          />
        ) : (
          <MTabs {...tabsProps} />
        ))}
    </div>
  );
}
