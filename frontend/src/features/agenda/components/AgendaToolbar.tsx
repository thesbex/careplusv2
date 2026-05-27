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
    </div>
  );
}

/**
 * Légende des statuts — bandeau bas (design officiel : la légende vit SOUS la
 * grille, pas dans la barre d'outils). Couleurs DS2 : saphir = en consultation,
 * vert = arrivé/terminé, ambre = attente constantes, corail = annulé/urgence.
 */
export function AgendaLegend() {
  return (
    <div className="ag-legend-bottom" aria-label="Légende des statuts">
      <span className="ag-legend-title">Légende</span>
      <span className="ag-leg-item" style={{ color: 'var(--ds2-navy)' }}>
        <i className="ag-leg-sw" style={{ background: 'var(--ds2-navy-soft)' }} /><span>Consultation</span>
      </span>
      <span className="ag-leg-item" style={{ color: 'var(--ds2-green)' }}>
        <i className="ag-leg-sw" style={{ background: '#d9eae0' }} /><span>Vaccination · arrivé</span>
      </span>
      <span className="ag-leg-item" style={{ color: 'var(--ds2-amber)' }}>
        <i className="ag-leg-sw" style={{ background: '#f4e4c4' }} /><span>En attente</span>
      </span>
      <span className="ag-leg-item" style={{ color: 'var(--ds2-coral)' }}>
        <i className="ag-leg-sw" style={{ background: '#f8ddd2' }} /><span>Urgent · retard</span>
      </span>
      <span className="ag-leg-item" style={{ color: '#7f7a6b' }}>
        <i className="ag-leg-sw" style={{ background: '#e1ded2' }} /><span>Indisponible · annulé</span>
      </span>
      <span className="ag-legend-hint">Glisser-déposer pour replanifier</span>
    </div>
  );
}
