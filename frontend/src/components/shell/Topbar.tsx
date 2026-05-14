import type { ReactNode } from 'react';
import { Search, Bell, Logout } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/auth/authStore';

export interface TopbarProps {
  title: string;
  sub?: string;
  showSearch?: boolean;
  pageDate?: string;
  right?: ReactNode;
  onSearchOpen?: () => void;
  onNotifications?: () => void;
  onLogout?: () => void;
}

export function Topbar({
  title,
  sub,
  showSearch = true,
  pageDate,
  right,
  onSearchOpen,
  onNotifications,
  onLogout,
}: TopbarProps) {
  const sessionUser = useAuthStore((s) => s.user);
  const sessionLabel = sessionUser
    ? `Session : Dr. ${sessionUser.firstName ?? ''} ${sessionUser.lastName ?? ''}`.trim()
    : null;
  return (
    <header className="cp-topbar">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <div className="cp-topbar-title">{title}</div>
        {sub && <div className="cp-topbar-sub">{sub}</div>}
      </div>

      {showSearch && (
        <button
          type="button"
          className="cp-search"
          onClick={onSearchOpen}
          aria-label="Rechercher un patient"
        >
          <Search />
          <span>Rechercher un patient par nom, téléphone, CIN…</span>
        </button>
      )}

      <div className="cp-topbar-right">
        {pageDate && (
          <div
            className="tnum"
            style={{ fontSize: 12, color: 'var(--ink-3)', padding: '0 4px' }}
          >
            {pageDate}
          </div>
        )}
        <Button variant="ghost" iconOnly aria-label="Notifications" onClick={onNotifications}>
          <Bell />
        </Button>
        {right}
        {onLogout && (
          <>
            {sessionLabel && <span className="cp-topbar-session">{sessionLabel}</span>}
            <Button
              variant="danger"
              size="sm"
              className="cp-topbar-logout"
              aria-label="Se déconnecter"
              title="Se déconnecter"
              onClick={onLogout}
            >
              <Logout />
              Déconnexion
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
