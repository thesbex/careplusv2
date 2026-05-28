import { ChevronLeft, ChevronRight } from '@/components/icons';

export type AgendaView = 'jour' | 'semaine' | 'mois';

interface AgendaToolbarProps {
  view: AgendaView;
  onViewChange: (v: AgendaView) => void;
  weekLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function AgendaToolbar({
  view, onViewChange, weekLabel, onPrev, onNext, onToday,
}: AgendaToolbarProps) {
  return (
    <div className="ag-toolbar">
      <div className="ag-week-nav" role="group" aria-label="Navigation semaine">
        <button type="button" aria-label="Précédent" onClick={onPrev}>
          <ChevronLeft />
        </button>
        <div className="vdv" />
        <button
          type="button"
          style={{ width: 'auto', padding: '0 12px', fontSize: 12, fontWeight: 500 }}
          onClick={onToday}
        >
          Aujourd'hui
        </button>
        <div className="vdv" />
        <button type="button" aria-label="Suivant" onClick={onNext}>
          <ChevronRight />
        </button>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.005em' }}>
        {weekLabel}
      </div>

      <div
        className="ag-view-toggle"
        role="group"
        aria-label="Période"
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
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* Légende inline RETIRÉE (2026-05-28, demande user) : doublon avec le
          bandeau légende bas (.ag-week-legend) qui rend Médecins ET Statuts
          en multi-praticien. En single-doctor il n'y a pas de légende toolbar
          non plus — les couleurs sont apprises à l'usage, le besoin réel de
          décodage vient surtout du multi-doctor (et la bottom legend le couvre). */}
    </div>
  );
}
