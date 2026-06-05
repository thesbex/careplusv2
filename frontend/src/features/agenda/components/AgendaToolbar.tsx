import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import { useT } from '@/lib/i18n/I18nProvider';

export type AgendaView = 'jour' | 'semaine' | 'mois';

interface AgendaToolbarProps {
  view: AgendaView;
  onViewChange: (v: AgendaView) => void;
  weekLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Slot d'actions aligné à droite (ex. bouton « Nouveau RDV », point 5). */
  actions?: ReactNode;
}

export function AgendaToolbar({
  view, onViewChange, weekLabel, onPrev, onNext, onToday, actions,
}: AgendaToolbarProps) {
  const { t } = useT();
  return (
    <div className="ag-toolbar">
      <div className="ag-week-nav" role="group" aria-label={t('agenda.weekNavAria')}>
        <button type="button" aria-label={t('agenda.prev')} onClick={onPrev}>
          <ChevronLeft />
        </button>
        <div className="vdv" />
        <button
          type="button"
          style={{ width: 'auto', padding: '0 12px', fontSize: 12, fontWeight: 500 }}
          onClick={onToday}
        >
          {t('agenda.today')}
        </button>
        <div className="vdv" />
        <button type="button" aria-label={t('agenda.next')} onClick={onNext}>
          <ChevronRight />
        </button>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.005em' }}>
        {weekLabel}
      </div>

      <div
        className="ag-view-toggle"
        role="group"
        aria-label={t('agenda.periodAria')}
        style={{ marginLeft: 18 }}
      >
        {(['jour', 'semaine', 'mois'] as AgendaView[]).map((v) => (
          <button
            key={v}
            type="button"
            className={view === v ? 'on' : ''}
            aria-pressed={view === v}
            onClick={() => onViewChange(v)}
          >
            {t(`agenda.view.${v}`)}
          </button>
        ))}
      </div>

      {/* Légende inline RETIRÉE (2026-05-28, demande user) : doublon avec le
          bandeau légende bas (.ag-week-legend) qui rend Médecins ET Statuts
          en multi-praticien. En single-doctor il n'y a pas de légende toolbar
          non plus — les couleurs sont apprises à l'usage, le besoin réel de
          décodage vient surtout du multi-doctor (et la bottom legend le couvre). */}

      {actions && <div className="ag-toolbar-actions">{actions}</div>}
    </div>
  );
}
