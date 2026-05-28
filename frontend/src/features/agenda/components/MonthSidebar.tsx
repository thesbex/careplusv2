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

const sectionTitle: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 600,
  color: 'var(--ink-2)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  margin: '4px 0 8px',
};

export function MonthSidebar({ monthLabel, appointments }: MonthSidebarProps) {
  const total = appointments.length;

  // Per-day count : drives both « Jours les plus chargés » AND la densité heatmap.
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

  // Top motifs : iso maquette user 2026-05-28 « TOP MOTIFS » list.
  const byReason = new Map<string, number>();
  for (const a of appointments) {
    const r = a.reasonLabel?.trim() || 'Sans motif';
    byReason.set(r, (byReason.get(r) ?? 0) + 1);
  }
  const maxReason = Array.from(byReason.values()).reduce((m, v) => Math.max(m, v), 0);
  const topMotifs = Array.from(byReason.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Densité heatmap : 7 cols × N rows, 1 carré par jour du mois affiché.
  // Couleur intensifiée selon le count, blanc pour 0.
  const heatmapCells = (() => {
    // On reconstitue le mois depuis monthLabel ("Mai 2026"). Fallback : maintenant.
    const monthIdx = MONTH_LABELS.findIndex((m) => monthLabel.toLowerCase().startsWith(m.replace('.', '')));
    const year = parseInt(monthLabel.split(/\s+/)[1] ?? String(new Date().getFullYear()), 10) || new Date().getFullYear();
    const month = monthIdx >= 0 ? monthIdx : new Date().getMonth();
    const first = new Date(year, month, 1);
    const dowMon0 = (first.getDay() + 6) % 7;
    const last = new Date(year, month + 1, 0);
    const cells: Array<{ iso: string | null; day: number | null; count: number }> = [];
    for (let i = 0; i < dowMon0; i++) cells.push({ iso: null, day: null, count: 0 });
    for (let d = 1; d <= last.getDate(); d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ iso, day: d, count: byDay.get(iso) ?? 0 });
    }
    while (cells.length % 7 !== 0) cells.push({ iso: null, day: null, count: 0 });
    return cells;
  })();
  const maxDay = Array.from(byDay.values()).reduce((m, v) => Math.max(m, v), 0);
  function heatColor(count: number): string {
    if (count === 0) return 'var(--ds2-surface-2)';
    const ratio = maxDay > 0 ? count / maxDay : 0;
    // 4 paliers d'intensité saphir : 25/50/75/100 %.
    if (ratio < 0.25) return 'rgba(30, 77, 171, 0.18)';
    if (ratio < 0.5) return 'rgba(30, 77, 171, 0.35)';
    if (ratio < 0.75) return 'rgba(30, 77, 171, 0.6)';
    return 'rgba(30, 77, 171, 0.92)';
  }

  // KPI cards : on calcule ce qu'on peut depuis les RDV du mois — plus de
  // placeholders "—" sur des métriques dérivables. Iso maquette user 2026-05-28.
  // Total RDV  : déjà calculé (appointments.length).
  // Nouveaux   : patient dont le premier RDV de l'année tombe dans ce mois.
  //              Approximé ici par "patient distinct n'ayant qu'un RDV ce mois"
  //              — vraie première-visite nécessiterait un round-trip patients.
  const uniquePatients = new Set(appointments.map((a) => a.patientId)).size;
  // Annulations : statuts ANNULE / NO_SHOW.
  const cancelled = appointments.filter(
    (a) => a.status === 'ANNULE' || a.status === 'NO_SHOW',
  ).length;
  // Taux de remplissage : ratio RDV créés vs créneaux théoriques (heuristique
  // 30 min × 8 h × 5 j ouvrés × N médecins). Sans liste médecins ici on
  // approxime à 1 médecin → 80 créneaux/semaine.
  const weeksInMonth = 4;
  const theoreticalSlots = 80 * weeksInMonth;
  const fillRate = theoreticalSlots > 0
    ? Math.min(100, Math.round((total / theoreticalSlots) * 100))
    : 0;

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
          a.reasonLabel ?? '',
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
    {
      l: 'Taux de remplissage',
      v: total > 0 ? `${fillRate} %` : '—',
      d: 'base 80 créneaux/semaine',
    },
    {
      l: 'Patients distincts',
      v: uniquePatients > 0 ? String(uniquePatients) : '—',
      d: total > 0 ? `${Math.round((uniquePatients / total) * 100)} % du volume` : '—',
    },
    {
      l: 'Annulations',
      v: String(cancelled),
      d: total > 0
        ? `${((cancelled / total) * 100).toFixed(1)} % — ${cancelled === 0 ? 'aucune' : cancelled < total * 0.05 ? 'bas' : 'élevé'}`
        : 'aucune',
    },
  ];

  // Sidebar header per maquette : month name capitalized, no year.
  // Subline : "Au 23 avril · 7 jours restants" — today's day + days left
  // until the end of the displayed month (when displayed month = today's
  // month). Outside the current month, just show the month name.
  const monthOnly = monthLabel.split(/\s+/)[0] ?? monthLabel;
  const headerMonth = `${monthOnly.charAt(0).toUpperCase()}${monthOnly.slice(1)}`;
  const headerSub = buildHeaderSub(monthLabel);

  return (
    <>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Vue d&apos;ensemble — {headerMonth}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{headerSub}</div>
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
        {/* Densité heatmap — iso maquette user 2026-05-28 « DENSITÉ ».
            Mini calendrier 7 colonnes × N rangs, intensité saphir = charge. */}
        {total > 0 && (
          <>
            <div style={sectionTitle}>Densité</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 3,
              marginBottom: 4,
            }}>
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                <div key={i} style={{ fontSize: 9, color: 'var(--ink-3)', textAlign: 'center', fontWeight: 600 }}>{d}</div>
              ))}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 3,
                marginBottom: 14,
              }}
              aria-label="Carte de densité du mois"
            >
              {heatmapCells.map((c, i) => (
                <div
                  key={i}
                  style={{
                    aspectRatio: '1',
                    background: c.day === null ? 'transparent' : heatColor(c.count),
                    borderRadius: 3,
                    border: c.day === null ? 'none' : '1px solid var(--border)',
                  }}
                  title={c.iso ? `${c.iso} : ${c.count} RDV` : ''}
                />
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--ink-3)', marginBottom: 16 }}>
              <span>Moins</span>
              {[0, 0.2, 0.4, 0.7, 1].map((r, i) => (
                <span key={i} style={{
                  width: 10, height: 10, borderRadius: 2,
                  background: r === 0 ? 'var(--ds2-surface-2)' : `rgba(30, 77, 171, ${0.18 + r * 0.7})`,
                  border: '1px solid var(--border)',
                }} />
              ))}
              <span>Plus</span>
            </div>

            {/* Top motifs — iso maquette user 2026-05-28 « TOP MOTIFS ». */}
            {topMotifs.length > 0 && (
              <>
                <div style={sectionTitle}>Top motifs</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {topMotifs.map(([label, n]) => {
                    const pct = maxReason > 0 ? Math.round((n / maxReason) * 100) : 0;
                    return (
                      <div key={label} style={{ fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ color: 'var(--ink-2)' }}>{label}</span>
                          <span className="tnum" style={{ fontWeight: 600 }}>{n}</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--ds2-surface-2)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--ds2-navy, var(--primary))' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        <div style={sectionTitle}>Jours les plus chargés</div>
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

/**
 * Builds the sidebar header sub-line per maquette :
 *   - When the sidebar shows the same month as today  →
 *     "Au {today.day} {month} · {N} jours restants"
 *   - Otherwise                                       →
 *     "{N} jours" or just the month label
 */
function buildHeaderSub(monthLabel: string): string {
  const today = new Date();
  const todayMonthLower = MONTH_LABELS[today.getMonth()] ?? '';
  const displayedMonth = monthLabel.split(/\s+/)[0]?.toLowerCase() ?? '';
  if (displayedMonth.startsWith(todayMonthLower.replace('.', ''))) {
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const remaining = last.getDate() - today.getDate();
    return `Au ${today.getDate()} ${todayMonthLower} · ${remaining} jours restants`;
  }
  return monthLabel;
}
