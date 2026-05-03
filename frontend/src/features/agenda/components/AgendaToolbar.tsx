import { ChevronLeft, ChevronRight } from '@/components/icons';

export function AgendaToolbar() {
  return (
    <div className="ag-toolbar">
      <div className="ag-week-nav" role="group" aria-label="Navigation semaine">
        <button type="button" aria-label="Semaine précédente">
          <ChevronLeft />
        </button>
        <div className="vdv" />
        <button type="button" style={{ width: 'auto', padding: '0 12px', fontSize: 12, fontWeight: 500 }}>
          Aujourd'hui
        </button>
        <div className="vdv" />
        <button type="button" aria-label="Semaine suivante">
          <ChevronRight />
        </button>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.005em' }}>
        20 – 25 avril 2026
      </div>

      <div
        className="ag-view-toggle"
        role="group"
        aria-label="Période"
        style={{ marginLeft: 18 }}
      >
        <button type="button">Jour</button>
        <button type="button" className="on" aria-pressed="true">
          Semaine
        </button>
        <button type="button">Mois</button>
      </div>

      <div className="ag-legend" aria-label="Légende des statuts">
        <span>
          <i style={{ background: '#C9D9EE' }} />
          Consultation
        </span>
        <span>
          <i style={{ background: '#F1E1A5' }} />
          En attente
        </span>
        <span>
          <i style={{ background: '#E4EDF8' }} />
          Arrivé
        </span>
        <span>
          <i style={{ background: '#F2F1EC' }} />
          Terminé
        </span>
      </div>
    </div>
  );
}
