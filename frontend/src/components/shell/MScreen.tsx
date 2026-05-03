import type { ReactNode } from 'react';
import { MTabs, type MTabsProps, type MobileTab } from './MTabs';
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
  badges = { salle: 3 },
  onTabChange,
  topbar,
  children,
  fab,
  noTabs = false,
}: MScreenProps) {
  const tabsProps: MTabsProps = {
    active: tab,
    badges,
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
