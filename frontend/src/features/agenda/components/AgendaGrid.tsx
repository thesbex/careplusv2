import { AgendaBlock } from './AgendaBlock';
import { HOURS, ROW_PX, pxFromMin, toMin } from '../fixtures';
import type { Appointment, DayKey, WeekDay } from '../types';

interface AgendaGridProps {
  days: WeekDay[];
  appointments: Appointment[];
  onSelect?: (a: Appointment) => void;
  /** Day key of "today" — used to render the current-time line. */
  today?: DayKey;
  /** "HH:MM" — used to position the now-line. */
  now?: string;
  /** Days that fall in a practitioner-leave range. Painted with a striped overlay. */
  leaveDays?: Set<DayKey>;
}

export function AgendaGrid({ days, appointments, onSelect, today = 'jeu', now = '09:47', leaveDays }: AgendaGridProps) {
  const nowTop = pxFromMin(toMin(now));
  return (
    <div className="ag-grid-wrap">
      <div className="ag-header">
        <div className="ag-header-cell" />
        {days.map((d) => (
          <div key={d.key} className={`ag-header-cell ${d.key === today ? 'today' : ''}`}>
            <span className="d-lbl">{d.label}</span>
            <span className="d-num">{d.date}</span>
          </div>
        ))}
      </div>
      <div className="ag-scroll scroll">
        <div className="ag-grid" style={{ height: HOURS.length * ROW_PX }}>
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
                d.key === today ? 'today' : '',
                leaveDays?.has(d.key) ? 'leave' : '',
              ]
                .filter(Boolean)
                .join(' ')}
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
                  <AgendaBlock key={`${d.key}-${i}`} a={a} {...(onSelect ? { onClick: onSelect } : {})} />
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
