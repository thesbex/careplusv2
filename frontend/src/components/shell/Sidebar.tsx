import type { ComponentType, SVGProps } from 'react';
import {
  Calendar,
  Users,
  Waiting,
  Stetho,
  Invoice,
  Settings,
  ChevronDown,
} from '@/components/icons';
import { BrandMark } from '@/components/ui/BrandMark';
import { Avatar } from '@/components/ui/Avatar';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export type SidebarScreen =
  | 'agenda'
  | 'patients'
  | 'salle'
  | 'consult'
  | 'factu'
  | 'params';

interface NavItem {
  id: SidebarScreen;
  label: string;
  Icon: IconComponent;
  section: 'flux' | 'config';
}

const ITEMS: NavItem[] = [
  { id: 'agenda', label: 'Agenda', Icon: Calendar, section: 'flux' },
  { id: 'patients', label: 'Patients', Icon: Users, section: 'flux' },
  { id: 'salle', label: "Salle d'attente", Icon: Waiting, section: 'flux' },
  { id: 'consult', label: 'Consultations', Icon: Stetho, section: 'flux' },
  { id: 'factu', label: 'Facturation', Icon: Invoice, section: 'flux' },
  { id: 'params', label: 'Paramètres', Icon: Settings, section: 'config' },
];

export interface SidebarProps {
  active?: SidebarScreen;
  counts?: { salle?: number };
  cabinet?: { name: string; city: string };
  user?: { name: string; role: string; initials: string };
  onNavigate?: (id: SidebarScreen) => void;
}

export function Sidebar({
  active = 'agenda',
  counts = { salle: 3 },
  cabinet = { name: 'careplus', city: 'Cab. El Amrani · Casablanca' },
  user = { name: 'Fatima Z. Benjelloun', role: 'Secrétaire', initials: 'FB' },
  onNavigate,
}: SidebarProps) {
  const flux = ITEMS.filter((i) => i.section === 'flux');
  const config = ITEMS.filter((i) => i.section === 'config');

  return (
    <nav className="cp-sidebar" aria-label="Navigation principale">
      <div className="cp-brand">
        <BrandMark size="sm" />
        <div style={{ minWidth: 0 }}>
          <div className="cp-brand-name">{cabinet.name}</div>
          <div className="cp-brand-cab">{cabinet.city}</div>
        </div>
      </div>

      <div className="cp-nav-section">Flux patient</div>
      {flux.map((it) => (
        <NavButton
          key={it.id}
          item={it}
          active={active === it.id}
          badge={it.id === 'salle' ? counts.salle : undefined}
          onClick={() => onNavigate?.(it.id)}
        />
      ))}

      <div className="cp-nav-section">Configuration</div>
      {config.map((it) => (
        <NavButton
          key={it.id}
          item={it}
          active={active === it.id}
          onClick={() => onNavigate?.(it.id)}
        />
      ))}

      <div className="cp-user-chip">
        <Avatar initials={user.initials} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="cp-user-name">{user.name}</div>
          <div className="cp-user-role">{user.role}</div>
        </div>
        <span style={{ color: 'var(--ink-4)' }} aria-hidden="true">
          <ChevronDown />
        </span>
      </div>
    </nav>
  );
}

function NavButton({
  item,
  active,
  badge,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  badge?: number | undefined;
  onClick: () => void;
}) {
  const { Icon, label } = item;
  return (
    <button
      type="button"
      className={`cp-nav-item ${active ? 'active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <span className="ico">
        <Icon />
      </span>
      <span>{label}</span>
      {typeof badge === 'number' && badge > 0 && (
        <span className="cp-nav-badge" aria-label={`${badge} en attente`}>
          {badge}
        </span>
      )}
    </button>
  );
}
