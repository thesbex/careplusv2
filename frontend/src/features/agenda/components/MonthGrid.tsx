/**
 * MonthGrid — month view of the agenda.
 *
 * Re-aligned with design-handoff-v2 / `screens/agenda.jsx::AgendaMois` :
 * each cell shows the day number + a "{count} RDV" line + a thin progress
 * bar at the bottom (intensity = count). The original "two appointment
 * pills + +N autres" rendering was rejected as off-design (chat2 user
 * feedback "agenda mois looks ugly + n'est pas iso maquette").
 *
 * The grid renders 5 or 6 weeks dynamically — exactly as many rows as the
 * month + leading/trailing blanks need, no more.
 */
import type { AppointmentApi } from '../hooks/useAppointments';
import type { Leave } from '@/features/parametres/types';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

interface MonthGridProps {
  /** Year of the month being displayed. */
  year: number;
  /** 0-indexed month. */
  month: number;
  appointments: AppointmentApi[];
  leaves: Leave[];
  onSelectDay: (iso: string) => void;
}

function isoOfDay(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isLeaveDay(iso: string, leaves: Leave[]): boolean {
  return leaves.some((l) => iso >= l.startDate && iso <= l.endDate);
}

function aptIso(a: AppointmentApi): string {
  const d = new Date(a.startAt);
  return isoOfDay(d.getFullYear(), d.getMonth(), d.getDate());
}

export function MonthGrid({ year, month, appointments, leaves, onSelectDay }: MonthGridProps) {
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const todayIso = isoOfDay(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());

  // First day of grid: Monday on or before the 1st of the month.
  const firstOfMonth = new Date(year, month, 1);
  const dowMon0 = (firstOfMonth.getDay() + 6) % 7; // Mon=0..Sun=6
  const gridStart = new Date(year, month, 1 - dowMon0);

  // Last day of month, then pad to fill the trailing week. Tend toward 5 rows
  // when possible (5 × 7 = 35), spill to 6 only when the month overflows.
  const lastOfMonth = new Date(year, month + 1, 0);
  const totalDays = dowMon0 + lastOfMonth.getDate();
  const cellCount = Math.ceil(totalDays / 7) * 7;

  const cells: { iso: string; day: number; outside: boolean; date: Date; isWeekend: boolean }[] = [];
  for (let i = 0; i < cellCount; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const dow = d.getDay(); // 0 = Sunday, 6 = Saturday
    cells.push({
      iso: isoOfDay(d.getFullYear(), d.getMonth(), d.getDate()),
      day: d.getDate(),
      outside: d.getMonth() !== month,
      date: d,
      isWeekend: dow === 0 || dow === 6,
    });
  }

  // Index appointments by day ISO for quick lookup.
  const byDay = new Map<string, number>();
  for (const a of appointments) {
    const k = aptIso(a);
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }

  return (
    <div className="ag-month">
      <div className="ag-month-head">
        {WEEKDAYS.map((w) => (
          <div key={w} className="ag-month-head-cell">
            {w}
          </div>
        ))}
      </div>
      <div className="ag-month-grid scroll" role="grid" aria-label="Agenda mensuel">
        {cells.map((cell) => {
          if (cell.outside) {
            return <div key={cell.iso} className="ag-month-cell ag-month-blank" aria-hidden="true" />;
          }
          const count = byDay.get(cell.iso) ?? 0;
          const onLeave = isLeaveDay(cell.iso, leaves);
          const isToday = cell.iso === todayIso;
          const cls = [
            'ag-month-cell',
            isToday ? 'today' : '',
            cell.isWeekend ? 'weekend' : '',
            onLeave ? 'leave' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={cell.iso}
              type="button"
              role="gridcell"
              className={cls}
              onClick={() => onSelectDay(cell.iso)}
              aria-label={`${cell.iso}${onLeave ? ' (congé)' : ''}, ${count} rendez-vous`}
            >
              <span className="ag-month-date tnum">{cell.day}</span>
              {onLeave && <span className="ag-month-leave-tag">Congé</span>}
              {count > 0 && (
                <>
                  <span className="ag-month-count tnum">{count} RDV</span>
                  <span className="ag-month-bar" aria-hidden="true">
                    <span style={{ width: `${Math.min(100, count * 8)}%` }} />
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
