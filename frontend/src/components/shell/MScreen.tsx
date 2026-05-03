import type { ReactNode } from 'react';
import { MTabs, type MTabsProps, type MobileTab } from './MTabs';
import { useSalleBadgeCount } from './useSalleBadgeCount';
import '@/styles/mobile.css';

export interface MScreenProps {
  tab?: MobileTab;
  badges?: MTabsProps['badges'];
  onTabChange?: MTabsProps['onTabChange'];
  topbar?: ReactNode;
  children: ReactNode;
  fab?: ReactNode;
  noTabs?: boolean;
}

/**
 * Mobile screen frame: topbar + scrollable body + optional FAB + bottom tab bar.
 * Mirrors design/prototype/mobile/shell.jsx:MScreen.
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
  // Salle d'attente badge — souscrit à /api/queue (cache partagé avec
  // useQueue, refetch 15 s). On ne tape pas le réseau si l'appelant a
  // déjà passé un `badges` explicite (ex. SalleAttentePage.mobile.tsx).
  const liveSalle = useSalleBadgeCount(badges === undefined);
  const resolvedBadges =
    badges ?? (liveSalle !== undefined && liveSalle > 0 ? { salle: liveSalle } : {});

  const tabsProps: MTabsProps = {
    active: tab,
    badges: resolvedBadges,
    ...(onTabChange !== undefined ? { onTabChange } : {}),
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
