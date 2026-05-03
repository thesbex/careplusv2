import { useEffect, useState, type ReactNode } from 'react';
import { Sidebar, type SidebarScreen, type SidebarProps } from './Sidebar';
import { Topbar, type TopbarProps } from './Topbar';
import { PatientSearchSpotlight } from './PatientSearchSpotlight';
import { useSalleBadgeCount } from './useSalleBadgeCount';
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
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K / Ctrl+K opens the patient spotlight from anywhere in the desktop app.
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

  // Salle d'attente badge — souscrit à /api/queue (cache partagé avec
  // useQueue, refetch 15 s). On ne tape pas le réseau si l'appelant a
  // déjà passé un `counts` explicite (override total).
  const liveSalle = useSalleBadgeCount(counts === undefined);
  const resolvedCounts: SidebarProps['counts'] =
    counts ?? (liveSalle !== undefined ? { salle: liveSalle } : undefined);

  const sidebarProps: SidebarProps = {
    active,
    ...(resolvedCounts !== undefined ? { counts: resolvedCounts } : {}),
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
          onSearchOpen={() => setSearchOpen(true)}
          {...topbarProps}
        />
        <div className="cp-content">
          <div className="cp-workspace">{children}</div>
          {right && <div className="cp-rightpanel">{right}</div>}
        </div>
      </div>
      <PatientSearchSpotlight open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
