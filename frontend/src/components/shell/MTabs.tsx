import { Calendar, Waiting, Users, Invoice, Menu, Stetho, Chat } from '@/components/icons';
import type { ComponentType, SVGProps } from 'react';
import { useT } from '@/lib/i18n/I18nProvider';

export type MobileTab = 'agenda' | 'salle' | 'patients' | 'factu' | 'menu';

/** Bottom-tab ids for pure-tech (LAB/RADIO-only) users — their cloister only
 *  allows the queue, messages and profil, so they get a dedicated 3-tab bar. */
export type TechMobileTab = 'queue' | 'messages' | 'profil';

interface Item {
  id: MobileTab;
  /** #122 — clé i18n du libellé (traduit au rendu). */
  labelKey: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const ITEMS: Item[] = [
  { id: 'agenda', labelKey: 'nav.agenda', Icon: Calendar },
  { id: 'salle', labelKey: 'ui.mtab.salle', Icon: Waiting },
  { id: 'patients', labelKey: 'nav.patients', Icon: Users },
  { id: 'factu', labelKey: 'ui.mtab.factures', Icon: Invoice },
  { id: 'menu', labelKey: 'ui.mtab.more', Icon: Menu },
];

export interface MTabsProps {
  active?: MobileTab;
  badges?: Partial<Record<MobileTab, number>>;
  onTabChange?: (tab: MobileTab) => void;
}

export function MTabs({ active = 'agenda', badges = {}, onTabChange }: MTabsProps) {
  const { t } = useT();
  return (
    <nav className="mtabs" aria-label={t('ui.mnav.mobile')}>
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
            <span>{t(it.labelKey)}</span>
            {typeof badge === 'number' && badge > 0 && (
              <span className="mtab-badge" aria-label={t('ui.mtab.badge', { n: badge, s: badge > 1 ? 's' : '' })}>
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

interface TechItem {
  id: TechMobileTab;
  /** #122 — clé i18n du libellé (traduit au rendu). */
  labelKey: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const TECH_ITEMS: TechItem[] = [
  { id: 'queue', labelKey: 'ui.mtab.queue', Icon: Stetho },
  { id: 'messages', labelKey: 'nav.messages', Icon: Chat },
  { id: 'profil', labelKey: 'ui.mtab.profil', Icon: Users },
];

export interface MTechTabsProps {
  active?: TechMobileTab;
  badges?: Partial<Record<TechMobileTab, number>>;
  onTabChange?: (tab: TechMobileTab) => void;
}

/**
 * Bottom tab bar for pure-tech (LAB/RADIO-only) users. They are cloistered to
 * their queue + messages + profil (see AppLayout), so the standard 5-tab bar
 * (agenda/salle/patients/factu) would only bounce them back. This bar exposes
 * exactly their reachable destinations — restoring desktop↔mobile parity for
 * Messages and Profil.
 */
export function MTechTabs({ active, badges = {}, onTabChange }: MTechTabsProps) {
  const { t } = useT();
  return (
    <nav className="mtabs" aria-label={t('ui.mnav.mobile')}>
      {TECH_ITEMS.map((it) => {
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
            <span>{t(it.labelKey)}</span>
            {typeof badge === 'number' && badge > 0 && (
              <span className="mtab-badge" aria-label={t('ui.mtab.badge', { n: badge, s: badge > 1 ? 's' : '' })}>
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
