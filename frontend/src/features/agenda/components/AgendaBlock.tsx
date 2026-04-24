import { Warn } from '@/components/icons';
import { toMin, pxFromMin } from '../fixtures';
import type { Appointment } from '../types';

interface AgendaBlockProps {
  a: Appointment;
  onClick?: (a: Appointment) => void;
}

/**
 * A single appointment block placed inside an .ag-daycol column. Handles the
 * compact (≤15-min) layout variant which lays out time + name + allergy dot
 * inline because a 15-min slot is only 18px tall.
 * Ported from design/prototype/screens/agenda.jsx:AgendaBlock.
 */
export function AgendaBlock({ a, onClick }: AgendaBlockProps) {
  const top = pxFromMin(toMin(a.start)) + 2;
  const height = pxFromMin(a.dur) - 4;
  const compact = a.dur <= 15;
  const cls = `ag-block ag-${a.status}${compact ? ' ag-compact' : ''}`;
  return (
    <button
      type="button"
      className={cls}
      style={{ top, height }}
      onClick={() => onClick?.(a)}
      aria-label={`${a.patient} à ${a.start}, ${a.reason}`}
    >
      {compact ? (
        <>
          <div className="ag-time tnum">{a.start}</div>
          <div className="ag-name">{a.patient}</div>
          {a.allergy && (
            <span className="ag-allergy-dot" title={`Allergie : ${a.allergy}`}>
              <Warn />
            </span>
          )}
        </>
      ) : (
        <>
          <div className="ag-time tnum">
            {a.start} · {a.dur}min
          </div>
          <div className="ag-name">{a.patient}</div>
          <div className="ag-reason">{a.reason}</div>
          {a.allergy && (
            <div className="ag-allergy" title={`Allergie : ${a.allergy}`}>
              <Warn /> <span>{a.allergy}</span>
            </div>
          )}
        </>
      )}
    </button>
  );
}
