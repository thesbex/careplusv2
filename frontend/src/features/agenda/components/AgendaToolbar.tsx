import { ChevronLeft, ChevronRight } from '@/components/icons';
import type { DayKey, WeekDay } from '../types';

export type AgendaView = 'jour' | 'semaine' | 'mois';

interface AgendaToolbarProps {
  view: AgendaView;
  onViewChange: (v: AgendaView) => void;
  weekLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /** For Jour view: the currently selected day. */
  selectedDay: DayKey;
  /** For Jour view: the week days to switch between. */
  days: WeekDay[];
  onDayChange: (k: DayKey) => void;
}

export function AgendaToolbar({
  view, onViewChange, weekLabel, onPrev, onNext, onToday,
  selectedDay, days, onDayChange,
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

      {view === 'jour' ? (
        <div className="ag-day-tabs" role="group" aria-label="Jour">
          {days.map((d) => (
            <button
              key={d.key}
              type="button"
              aria-pressed={d.key === selectedDay}
              onClick={() => onDayChange(d.key)}
              style={{
                padding: '2px 10px',
                fontSize: 12,
                fontWeight: d.key === selectedDay ? 600 : 500,
                borderRadius: 6,
                border: d.key === selectedDay ? '1px solid var(--primary)' : '1px solid transparent',
                background: d.key === selectedDay ? 'var(--primary-soft)' : 'transparent',
                color: d.key === selectedDay ? 'var(--primary)' : 'var(--ink-2)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {d.label.slice(0, 3)} {d.date}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.005em' }}>
          {weekLabel}
        </div>
      )}

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

      <div className="ag-legend" aria-label="Légende des statuts">
        <span><i style={{ background: '#C9D9EE' }} />Consultation</span>
        <span><i style={{ background: '#F1E1A5' }} />En attente</span>
        <span><i style={{ background: '#E4EDF8' }} />Arrivé</span>
        <span><i style={{ background: '#F2F1EC' }} />Terminé</span>
      </div>
    </div>
  );
}
