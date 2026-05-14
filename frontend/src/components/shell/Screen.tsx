import { type ReactNode } from 'react';
import { type SidebarScreen, type SidebarProps } from './Sidebar';
import { Topbar, type TopbarProps } from './Topbar';
import { useSpotlight } from './spotlightContext';
import { performLogout } from '@/lib/auth/useAuth';

export interface ScreenProps {
  /**
   * Sidebar item to mark as active. Kept for backwards compat — AppLayout
   * actually derives the active item from the URL via pathToSidebarScreen,
   * so this prop is informational only.
   */
  active: SidebarScreen;
  title: string;
  sub?: string;
  pageDate?: string;
  topbarRight?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  /** Deprecated: AppLayout reads counts directly from the badge hooks. Ignored. */
  counts?: SidebarProps['counts'];
  /** Deprecated: AppLayout owns sidebar navigation. Ignored. */
  onNavigate?: SidebarProps['onNavigate'];
  topbarProps?: Partial<Omit<TopbarProps, 'title' | 'sub' | 'pageDate' | 'right'>>;
}

/**
 * Per-page chrome: Topbar + workspace + optional right panel.
 *
 * The Sidebar / global Spotlight / ⌘K handler used to live here, which meant
 * every router navigation unmounted the entire chrome and triggered a visible
 * refresh flash. Those moved up to <AppLayout> (lib/router/routes.tsx) and
 * now mount once per session.
 *
 * Pages still call <Screen active="patients" title=...>{children}</Screen>
 * unchanged — `active`/`counts`/`onNavigate` props are accepted but ignored
 * (AppLayout derives them from the URL + global hooks).
 */
export function Screen({
  title,
  sub,
  pageDate,
  topbarRight,
  right,
  children,
  topbarProps,
}: ScreenProps) {
  const { openSpotlight } = useSpotlight();
  return (
    <>
      <Topbar
        title={title}
        {...(sub !== undefined ? { sub } : {})}
        {...(pageDate !== undefined ? { pageDate } : {})}
        {...(topbarRight !== undefined ? { right: topbarRight } : {})}
        onSearchOpen={openSpotlight}
        onLogout={performLogout}
        {...topbarProps}
      />
      <div className="cp-content">
        <div className="cp-workspace">{children}</div>
        {right && <div className="cp-rightpanel">{right}</div>}
      </div>
    </>
  );
}
