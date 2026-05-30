import type { ReactNode } from 'react';
import { Search, Bell } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { useT } from '@/lib/i18n/I18nProvider';

export interface TopbarProps {
  title: string;
  sub?: string;
  showSearch?: boolean;
  pageDate?: string;
  right?: ReactNode;
  onSearchOpen?: () => void;
  onNotifications?: () => void;
  /** Conservé pour compat — la déconnexion vit désormais dans le menu de la sidebar (DS2). */
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
}: TopbarProps) {
  const { t } = useT();
  return (
    <header className="cp-topbar">
      <div className="cp-topbar-head">
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
          <span>{t('topbar.searchPatient')}</span>
        </button>
      )}

      <div className="cp-topbar-right">
        {pageDate && (
          <div className="tnum" style={{ fontSize: 12, color: 'var(--ds2-ink-3)', padding: '0 4px' }}>
            {pageDate}
          </div>
        )}
        <Button
          variant="ghost"
          iconOnly
          className="cp-topbar-bell"
          aria-label={t('topbar.notifications')}
          onClick={onNotifications}
        >
          <Bell />
        </Button>
        {right}
      </div>
    </header>
  );
}
