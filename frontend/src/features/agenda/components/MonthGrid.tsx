/**
 * MonthGrid — 6×7 calendar for the "mois" agenda view.
 * Each cell shows the day number + first 2 appointment time/patient pills,
 * and a "+N" overflow indicator. Leave days are visually striped.
 * Clicking a day inside the displayed month emits onSelectDay.
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

function timeOfApt(a: AppointmentApi): string {
  const d = new Date(a.startAt);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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

  // 6 rows × 7 cols = 42 cells
  const cells: { iso: string; day: number; outside: boolean; date: Date }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({
      iso: isoOfDay(d.getFullYear(), d.getMonth(), d.getDate()),
      day: d.getDate(),
      outside: d.getMonth() !== month,
      date: d,
    });
  }

  // Index appointments by day ISO for quick lookup.
  const byDay = new Map<string, AppointmentApi[]>();
  for (const a of appointments) {
    const k = aptIso(a);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(a);
  }
  // Sort within each day.
  for (const list of byDay.values()) {
    list.sort((a, b) => a.startAt.localeCompare(b.startAt));
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
          const apts = byDay.get(cell.iso) ?? [];
          const onLeave = isLeaveDay(cell.iso, leaves);
          const isToday = cell.iso === todayIso;
          const cls = [
            'ag-month-cell',
            cell.outside ? 'outside' : '',
            isToday ? 'today' : '',
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
              onClick={() => {
                if (!cell.outside) onSelectDay(cell.iso);
              }}
              disabled={cell.outside}
              aria-label={`${cell.iso}${onLeave ? ' (congé)' : ''}, ${apts.length} rendez-vous`}
            >
              <span className="ag-month-day-num">{cell.day}</span>
              {onLeave && !cell.outside && <span className="ag-month-leave-tag">Congé</span>}
              {!cell.outside &&
                apts.slice(0, 2).map((a) => (
                  <span key={a.id} className="ag-month-apt-pill" title={a.patientFullName ?? ''}>
                    {timeOfApt(a)} · {a.patientFullName ?? '—'}
                  </span>
                ))}
              {apts.length > 2 && <span className="ag-month-more">+{apts.length - 2} autres</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
