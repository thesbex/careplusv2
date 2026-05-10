/**
 * MonthSidebar — right panel for the Mois view.
 *
 * Mirrors design-handoff-v2 / `screens/agenda.jsx::MonthSidebar`. Replaces
 * the TodayArrivals panel that AgendaPage normally renders for jour/semaine.
 *
 * Data caveat: only "Total RDV" and "Jours les plus chargés" are derived
 * from real data (the month-scoped `appointments` array passed in). The
 * other 3 KPI tiles (taux de remplissage / nouveaux patients / annulations)
 * are placeholders rendered with "—" until the backend exposes them — they
 * keep the layout intact so the screen reads as in the maquette.
 */
import type { AppointmentApi } from '../hooks/useAppointments';

interface MonthSidebarProps {
  /** Month label (ex. "Avril 2026") used as the panel header subtitle. */
  monthLabel: string;
  appointments: AppointmentApi[];
}

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTH_LABELS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juill.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function MonthSidebar({ monthLabel, appointments }: MonthSidebarProps) {
  const total = appointments.length;

  // Top 4 busiest days in the month.
  const byDay = new Map<string, number>();
  const labelByDay = new Map<string, string>();
  for (const a of appointments) {
    const d = new Date(a.startAt);
    const iso = d.toISOString().slice(0, 10);
    byDay.set(iso, (byDay.get(iso) ?? 0) + 1);
    if (!labelByDay.has(iso)) {
      labelByDay.set(iso, `${DAY_LABELS[d.getDay()]} ${d.getDate()}`);
    }
  }
  const topDays = Array.from(byDay.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([iso, n]) => ({ iso, label: labelByDay.get(iso) ?? iso, n }));

  function exportCsv() {
    const rows = [
      ['date', 'heure', 'patient', 'motif', 'statut'],
      ...appointments.map((a) => {
        const d = new Date(a.startAt);
        const date = d.toISOString().slice(0, 10);
        const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        return [
          date,
          time,
          a.patientFullName ?? '—',
          a.reason ?? '',
          a.status ?? '',
        ];
      }),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = monthLabel.toLowerCase().replace(/\s+/g, '-');
    a.download = `agenda-${slug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const stats = [
    { l: 'Total RDV', v: total > 0 ? String(total) : '—', d: 'sur le mois affiché' },
    { l: 'Taux de remplissage', v: '—', d: 'connecté à venir' },
    { l: 'Nouveaux patients', v: '—', d: 'connecté à venir' },
    { l: 'Annulations', v: '—', d: 'connecté à venir' },
  ];

  return (
    <>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Vue d&apos;ensemble — {monthLabel}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
          {monthLabelToday()}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 14 }} className="scroll">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {stats.map((s) => (
            <div
              key={s.l}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)',
                padding: '10px 12px',
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  color: 'var(--ink-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontWeight: 550,
                }}
              >
                {s.l}
              </div>
              <div
                className="tnum"
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  marginTop: 2,
                  color: 'var(--ink)',
                }}
              >
                {s.v}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>{s.d}</div>
            </div>
          ))}
        </div>
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: 'var(--ink-2)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            margin: '4px 0 8px',
          }}
        >
          Jours les plus chargés
        </div>
        {topDays.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)', padding: '8px 0' }}>
            Aucun rendez-vous ce mois.
          </div>
        )}
        {topDays.map((t) => (
          <div
            key={t.iso}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: '1px dashed var(--border)',
            }}
          >
            <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{t.label}</span>
            <span className="tnum" style={{ fontSize: 12.5, fontWeight: 600 }}>
              {t.n} RDV
            </span>
          </div>
        ))}
        <button
          type="button"
          onClick={exportCsv}
          disabled={total === 0}
          style={{
            width: '100%',
            justifyContent: 'center',
            marginTop: 16,
            padding: '8px 12px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            cursor: total === 0 ? 'not-allowed' : 'pointer',
            fontSize: 12.5,
            fontWeight: 500,
            color: 'var(--ink-2)',
            fontFamily: 'inherit',
            opacity: total === 0 ? 0.6 : 1,
          }}
        >
          Exporter le mois (CSV)
        </button>
      </div>
    </>
  );
}

function monthLabelToday(): string {
  const d = new Date();
  return `Au ${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`;
}
