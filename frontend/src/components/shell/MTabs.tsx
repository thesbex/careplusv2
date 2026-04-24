import { Calendar, Waiting, Users, Invoice, Menu } from '@/components/icons';
import type { ComponentType, SVGProps } from 'react';

export type MobileTab = 'agenda' | 'salle' | 'patients' | 'factu' | 'menu';

interface Item {
  id: MobileTab;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const ITEMS: Item[] = [
  { id: 'agenda', label: 'Agenda', Icon: Calendar },
  { id: 'salle', label: 'Salle', Icon: Waiting },
  { id: 'patients', label: 'Patients', Icon: Users },
  { id: 'factu', label: 'Factures', Icon: Invoice },
  { id: 'menu', label: 'Plus', Icon: Menu },
];

export interface MTabsProps {
  active?: MobileTab;
  badges?: Partial<Record<MobileTab, number>>;
  onTabChange?: (tab: MobileTab) => void;
}

export function MTabs({ active = 'agenda', badges = {}, onTabChange }: MTabsProps) {
  return (
    <nav className="mtabs" aria-label="Navigation mobile">
      {ITEMS.map((it) => {
        const badge = badges[it.id];
        const on = active === it.id;
        return (
          <button
            key={it.id}
            type="button"
            className={`mtab ${on ? 'on' : ''}`}
            aria-current={on ? 'page' : undefined}
            onClick={() => onTabChange?.(it.id)}
            style={{ background: 'transparent', border: 0, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <it.Icon />
            <span>{it.label}</span>
            {typeof badge === 'number' && badge > 0 && (
              <span className="mtab-badge" aria-label={`${badge} notification${badge > 1 ? 's' : ''}`}>
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
