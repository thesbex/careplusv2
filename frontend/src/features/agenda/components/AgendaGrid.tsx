import { AgendaBlock } from './AgendaBlock';
import { HOURS, ROW_PX, pxFromMin, toMin } from '../fixtures';
import type { Appointment, DayKey, WeekDay } from '../types';

interface AgendaGridProps {
  days: WeekDay[];
  appointments: Appointment[];
  onSelect?: (a: Appointment) => void;
  /** Click on an empty area of a day column → "HH:MM" snapped to 5 min. */
  onSlotClick?: (dayKey: DayKey, time: string) => void;
  /** Drop a dragged appointment block on a day column → new (day, "HH:MM"). */
  onMove?: (appointmentId: string, dayKey: DayKey, time: string) => void;
  /** Day key of "today" — used to render the current-time line. */
  today?: DayKey;
  /** "HH:MM" — used to position the now-line. */
  now?: string;
  /** Days that fall in a practitioner-leave range. Painted with a striped overlay. */
  leaveDays?: Set<DayKey>;
  /**
   * Jour view mode (one day, full-width). Per design-handoff-v2 / `screens/
   * agenda.jsx::AgendaJour`, the single header cell carries the `today` class
   * (gradient highlight regardless of the actual current day) and gets a
   * right-aligned "X RDV programmés" suffix.
   */
  jourMode?: boolean;
}

const FIRST_HOUR = 8;
const SNAP_MIN = 5;

function snapTimeFromY(yPx: number, totalRows: number): string {
  const max = totalRows * 60;
  const totalMin = Math.max(0, Math.min(max - SNAP_MIN, (yPx / 72) * 60));
  const snapped = Math.round(totalMin / SNAP_MIN) * SNAP_MIN;
  const h = FIRST_HOUR + Math.floor(snapped / 60);
  const m = snapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function AgendaGrid({ days, appointments, onSelect, onSlotClick, onMove, today = 'jeu', now = '09:47', leaveDays, jourMode = false }: AgendaGridProps) {
  const nowTop = pxFromMin(toMin(now));
  // The base CSS hardcodes `grid-template-columns: 56px repeat(6, 1fr)` for a
  // 6-day week. When the page passes a single day (jour view), the 5 phantom
  // columns showed up as empty space to the right of the only real column.
  // Override inline so the day column fills the workspace.
  const colTemplate = `56px repeat(${Math.max(1, days.length)}, 1fr)`;
  return (
    <div className="ag-grid-wrap">
      <div className="ag-header" style={{ gridTemplateColumns: colTemplate }}>
        <div className="ag-header-cell" />
        {days.map((d) => {
          const isHighlighted = jourMode || d.key === today;
          const dayItemCount = appointments.filter((a) => a.day === d.key).length;
          return (
            <div key={d.key} className={`ag-header-cell ${isHighlighted ? 'today' : ''}`}>
              <span className="d-lbl">{d.label}</span>
              <span className="d-num">{d.date}</span>
              {jourMode && (
                <span className="ag-day-count">{dayItemCount} RDV programmés</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="ag-scroll scroll">
        <div className="ag-grid" style={{ height: HOURS.length * ROW_PX, gridTemplateColumns: colTemplate }}>
          <div className="ag-hourcol">
            {HOURS.map((h) => (
              <div key={h} className="ag-hour-label tnum">
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          {days.map((d) => (
            <div
              key={d.key}
              className={[
                'ag-daycol',
                jourMode || d.key === today ? 'today' : '',
                leaveDays?.has(d.key) ? 'leave' : '',
                onSlotClick ? 'clickable' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={(e) => {
                if (!onSlotClick) return;
                // Ignore clicks that bubbled from an existing appointment block.
                if ((e.target as HTMLElement).closest('.ag-block')) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const time = snapTimeFromY(e.clientY - rect.top, HOURS.length);
                onSlotClick(d.key, time);
              }}
              onDragOver={(e) => {
                if (!onMove) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                if (!onMove) return;
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                if (!id) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const time = snapTimeFromY(e.clientY - rect.top, HOURS.length);
                onMove(id, d.key, time);
              }}
            >
              {HOURS.map((h) => (
                <div key={h} className="ag-hour-cell" />
              ))}
              {d.key === today && (
                <div className="ag-now" style={{ top: nowTop }} aria-label={`Heure actuelle ${now}`}>
                  <span className="ag-now-lbl tnum">{now}</span>
                </div>
              )}
              {appointments
                .filter((a) => a.day === d.key)
                .map((a, i) => (
                  <AgendaBlock
                    key={`${d.key}-${i}`}
                    a={a}
                    {...(onSelect ? { onClick: onSelect } : {})}
                    draggable={!!onMove}
                  />
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
