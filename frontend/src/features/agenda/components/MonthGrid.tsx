/**
 * MonthGrid — month view of the agenda.
 *
 * Refonte 2026-05-28 (user image "TJRS PAS ISO") :
 * - chaque cellule rend désormais le n° du jour + jusqu'à 3 LOZANGES RDV
 *   (event-block style Google Calendar) colorés selon le statut, + "+N autres"
 *   si la journée en compte plus.
 * - le rendu "count + intensity bar" précédent était trop pauvre — la
 *   maquette envoyée par l'utilisateur impose des event lozenges.
 *
 * La grille rend 5 ou 6 semaines dynamiquement.
 */
import type { AppointmentApi } from '../hooks/useAppointments';
import type { Leave } from '@/features/parametres/types';

const STATUS_TO_COLOR: Record<string, string> = {
  PLANIFIE: '#1E4DAB',
  CONFIRME: '#1E4DAB',
  ARRIVE: '#2F8F6B',
  EN_ATTENTE_CONSTANTES: '#2F8F6B',
  CONSTANTES_PRISES: '#C68A2E',
  EN_CONSULTATION: '#1E4DAB',
  TERMINE: '#9B9B9B',
  CLOS: '#9B9B9B',
  ANNULE: '#C2553A',
  NO_SHOW: '#C2553A',
};
const STATUS_TO_BG: Record<string, string> = {
  PLANIFIE: '#DCE5F5',
  CONFIRME: '#DCE5F5',
  ARRIVE: '#DEF0E6',
  EN_ATTENTE_CONSTANTES: '#DEF0E6',
  CONSTANTES_PRISES: '#FBEFE3',
  EN_CONSULTATION: '#1E4DAB',
  TERMINE: '#F2F1EC',
  CLOS: '#F2F1EC',
  ANNULE: '#F8DDD2',
  NO_SHOW: '#F8DDD2',
};

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

  // Index appointments by day ISO for quick lookup (full list, not just count).
  const byDay = new Map<string, AppointmentApi[]>();
  for (const a of appointments) {
    const k = aptIso(a);
    const arr = byDay.get(k) ?? [];
    arr.push(a);
    byDay.set(k, arr);
  }
  // Tri par heure dans chaque jour pour que les lozenges du matin apparaissent
  // en premier (lecture chronologique).
  for (const arr of byDay.values()) {
    arr.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
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
          const dayApts = byDay.get(cell.iso) ?? [];
          const count = dayApts.length;
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
          // Max 3 lozenges visibles + « +N autres » (iso maquette user 2026-05-28).
          const MAX_VISIBLE = 3;
          const visible = dayApts.slice(0, MAX_VISIBLE);
          const overflow = Math.max(0, count - MAX_VISIBLE);
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
                <div className="ag-month-events">
                  {visible.map((a) => {
                    const bg = STATUS_TO_BG[a.status] ?? '#DCE5F5';
                    const border = STATUS_TO_COLOR[a.status] ?? '#1E4DAB';
                    const isFilled = a.status === 'EN_CONSULTATION';
                    const d = new Date(a.startAt);
                    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                    const name = a.patientFullName ?? '—';
                    // Patient compacté : « Y. Lehoul » (initiale + nom).
                    const compact = (() => {
                      const parts = name.trim().split(/\s+/);
                      if (parts.length < 2) return name;
                      return `${parts[0]!.charAt(0)}. ${parts.slice(1).join(' ')}`;
                    })();
                    return (
                      <span
                        key={a.id}
                        className="ag-month-event"
                        style={{
                          background: isFilled ? border : bg,
                          color: isFilled ? '#fff' : border,
                          borderLeft: `3px solid ${border}`,
                        }}
                        title={`${time} · ${name}${a.reasonLabel ? ` · ${a.reasonLabel}` : ''}`}
                      >
                        <span className="ag-month-event-time tnum">{time}</span>
                        <span className="ag-month-event-name">{compact}</span>
                      </span>
                    );
                  })}
                  {overflow > 0 && (
                    <span className="ag-month-overflow tnum">+{overflow} autres</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
