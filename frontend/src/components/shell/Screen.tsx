import type { ReactNode } from 'react';
import { Sidebar, type SidebarScreen, type SidebarProps } from './Sidebar';
import { Topbar, type TopbarProps } from './Topbar';
import '@/styles/shell.css';

export interface ScreenProps {
  active: SidebarScreen;
  title: string;
  sub?: string;
  pageDate?: string;
  topbarRight?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  counts?: SidebarProps['counts'];
  onNavigate?: SidebarProps['onNavigate'];
  topbarProps?: Partial<Omit<TopbarProps, 'title' | 'sub' | 'pageDate' | 'right'>>;
}

/**
 * Desktop screen frame: Sidebar + Topbar + workspace + optional RightPanel.
 * Mirrors design/prototype/shell.jsx:Screen. Wrap your page content with <Screen>.
 */
export function Screen({
  active,
  title,
  sub,
  pageDate,
  topbarRight,
  right,
  children,
  counts,
  onNavigate,
  topbarProps,
}: ScreenProps) {
  const sidebarProps: SidebarProps = {
    active,
    ...(counts !== undefined ? { counts } : {}),
    ...(onNavigate !== undefined ? { onNavigate } : {}),
  };
  return (
    <div className="cp-app">
      <Sidebar {...sidebarProps} />
      <div className="cp-main">
        <Topbar
          title={title}
          {...(sub !== undefined ? { sub } : {})}
          {...(pageDate !== undefined ? { pageDate } : {})}
          {...(topbarRight !== undefined ? { right: topbarRight } : {})}
          {...topbarProps}
        />
        <div className="cp-content">
          <div className="cp-workspace">{children}</div>
          {right && <div className="cp-rightpanel">{right}</div>}
        </div>
      </div>
    </div>
  );
}
