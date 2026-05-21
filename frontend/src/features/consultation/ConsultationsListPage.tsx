/**
 * /consultations — historique iso-prototype `liste-consultations.jsx`.
 *
 * Layout : KPI strip → segmented control + sort → filter chips → tables
 * groupées par jour (Heure / Patient / Motif · Dx / Type · Médecin / Durée /
 * Statut / Suite) → pagination.
 *
 * Mobile : conserve la version cards simple (l'audit est focus desktop).
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Pill } from '@/components/ui/Pill';
import { Button } from '@/components/ui/Button';
import { ChevronRight, ChevronLeft, ChevronDown, Lock, Doc, Plus, File } from '@/components/icons';
import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import { useConsultations } from './hooks/useConsultations';
import type { ConsultationApi } from './hooks/useConsultation';

const NAV_MAP = {
  dashboard: '/dashboard',
  agenda: '/agenda',
  patients: '/patients',
  salle: '/salle',
  consult: '/consultations',
  factu: '/facturation',
  vaccinations: '/vaccinations',
  grossesses: '/grossesses',
  stock: '/stock',
  queueLab: '/queue/lab',
  queueRadio: '/queue/radio',
  messages: '/messages',
  catalogue: '/catalogue',
  params: '/parametres',
} as const;

const TAB_MAP: Record<MobileTab, string> = {
  agenda: '/agenda',
  salle: '/salle',
  patients: '/patients',
  factu: '/facturation',
  menu: '/parametres',
};

const AVATAR_COLORS = ['#1E5AA8', '#2A7CE7', '#6B6B6B', '#3F7A3A', '#B8500C'];

type SegmentKey = 'toutes' | 'aujourdhui' | 'semaine' | 'en-cours' | 'annulees';

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function formatId(c: ConsultationApi): string {
  // "CS-YYYY-XXXX" friendly format anchored on creation year + last 5 hex chars.
  const d = new Date(c.createdAt);
  const year = d.getFullYear();
  const tail = c.id.replace(/-/g, '').slice(-5).toUpperCase();
  return `CS-${year}-${tail}`;
}

function formatHeure(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' });
}

function dateKey(iso: string): string {
  // YYYY-MM-DD local
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(key: string, today: string, yesterday: string): string {
  const d = new Date(key);
  const human = d.toLocaleDateString('fr-MA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  if (key === today) return `Aujourd'hui · ${human}`;
  if (key === yesterday) return `Hier · ${human}`;
  return human.charAt(0).toUpperCase() + human.slice(1);
}

function durationMinutes(c: ConsultationApi): number | null {
  if (c.status === 'SIGNEE' && c.signedAt) {
    const ms = new Date(c.signedAt).getTime() - new Date(c.startedAt).getTime();
    return Math.max(1, Math.round(ms / 60_000));
  }
  if (c.status === 'BROUILLON') {
    const ms = Date.now() - new Date(c.startedAt).getTime();
    return Math.max(1, Math.round(ms / 60_000));
  }
  return null;
}

function statusKey(c: ConsultationApi): 'en-cours' | 'terminee' | 'annulee' {
  if (c.status === 'SIGNEE' || c.status === 'AMENDEE') return 'terminee';
  return 'en-cours'; // BROUILLON / SUSPENDUE both show as in-progress here
}

function patientInitials(patientId: string): string {
  // Without a patient-name endpoint in scope, derive readable initials from the
  // first 2 hex chars — keeps the avatar pattern stable while we wait for the
  // backend to widen the consultation list response (BACKLOG).
  const hex = patientId.replace(/-/g, '').slice(0, 2).toUpperCase();
  return hex;
}

function avatarColor(patientId: string): string {
  const seed = patientId.charCodeAt(patientId.length - 1);
  return AVATAR_COLORS[seed % AVATAR_COLORS.length]!;
}

// ── KPI helpers ─────────────────────────────────────────────────────────────

function computeKpis(consultations: ConsultationApi[], todayKey: string) {
  const today = consultations.filter((c) => dateKey(c.startedAt) === todayKey);
  const todayInProgress = today.filter((c) => c.status === 'BROUILLON' || c.status === 'SUSPENDUE').length;
  const todayDone = today.filter((c) => c.status === 'SIGNEE').length;

  const signed = consultations.filter((c) => c.status === 'SIGNEE' && c.signedAt);
  const avgDur =
    signed.length === 0
      ? null
      : Math.round(
          signed.reduce((sum, c) => {
            const m = durationMinutes(c);
            return sum + (m ?? 0);
          }, 0) / signed.length,
        );

  return {
    todayCount: today.length,
    todayInProgress,
    todayDone,
    avgDuration: avgDur,
  };
}

// ── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  unit,
  sub,
  warn,
}: {
  label: string;
  value: string;
  unit?: string;
  sub: string;
  warn?: boolean;
}) {
  return (
    <Panel style={{ padding: '10px 14px' }}>
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--ink-3)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 2 }}>
        <span
          className="tnum"
          style={{
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: warn ? 'var(--amber)' : 'var(--ink)',
          }}
        >
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: 12, color: 'var(--ink-3)', marginLeft: 4 }}>{unit}</span>
        )}
      </div>
      <div
        style={{
          fontSize: 11,
          color: warn ? 'var(--amber)' : 'var(--ink-3)',
          marginTop: 1,
        }}
      >
        {sub}
      </div>
    </Panel>
  );
}

function FilterChip({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      style={{
        height: 28,
        padding: '0 10px',
        border: '1px solid var(--border)',
        borderRadius: 14,
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11.5,
        cursor: 'pointer',
        color: muted ? 'var(--ink-3)' : 'var(--ink)',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
      <ChevronDown />
    </button>
  );
}

function DayHeader({ label, count }: { label: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '14px 4px 8px' }}>
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--ink-2)',
        }}
      >
        {label}
      </span>
      <span className="tnum" style={{ fontSize: 11, color: 'var(--ink-4)' }}>
        · {count} consultation{count > 1 ? 's' : ''}
      </span>
    </div>
  );
}

const TABLE_GRID = '90px 1.4fr 1.5fr 1fr 90px 120px 130px';

function TableHeader() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: TABLE_GRID,
        padding: '10px 16px',
        gap: 14,
        fontSize: 10.5,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--ink-3)',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface-2)',
      }}
    >
      <span>Heure</span>
      <span>Patient</span>
      <span>Motif · Diagnostic</span>
      <span>Type · Médecin</span>
      <span style={{ textAlign: 'right' }}>Durée</span>
      <span>Statut</span>
      <span>Suite</span>
    </div>
  );
}

function ConsultationRow({
  c,
  last,
  selected,
  onClick,
}: {
  c: ConsultationApi;
  last: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const initials = patientInitials(c.patientId);
  const color = avatarColor(c.patientId);
  const statut = statusKey(c);
  const dur = durationMinutes(c);

  const statutBadge =
    statut === 'en-cours'
      ? { bg: 'var(--primary-soft)', fg: 'var(--primary)', label: 'En cours', dot: true }
      : statut === 'annulee'
        ? { bg: 'var(--bg-alt)', fg: 'var(--ink-4)', label: 'Annulée', dot: false, strike: true }
        : { bg: '#E6F0E5', fg: '#2E5A2A', label: 'Terminée', dot: false };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: TABLE_GRID,
        padding: '12px 16px',
        gap: 14,
        alignItems: 'center',
        borderBottom: last ? 'none' : '1px solid var(--border-soft)',
        background: selected ? 'var(--primary-soft)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.08s',
      }}
    >
      <div>
        <div className="tnum" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
          {formatHeure(c.startedAt)}
        </div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 1 }}>
          {formatId(c)}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div
          className="cp-avatar"
          style={{
            background: color,
            color: '#fff',
            width: 32,
            height: 32,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            fontSize: 11,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 13.5,
              color: 'var(--ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Patient {shortId(c.patientId)}
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>
            dossier · —
          </div>
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 12.5,
            color: 'var(--ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {c.motif || '—'}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
          {c.diagnosis ? (
            <span
              className="mono"
              style={{
                fontSize: 10,
                padding: '1px 5px',
                borderRadius: 3,
                background: 'var(--bg-alt)',
                color: 'var(--ink-2)',
                border: '1px solid var(--border)',
                fontWeight: 600,
              }}
            >
              {c.diagnosis.slice(0, 10)}
            </span>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--ink-4)' }}>—</span>
          )}
        </div>
      </div>

      <div style={{ fontSize: 12, minWidth: 0 }}>
        <div style={{ fontWeight: 550, color: 'var(--ink-2)' }}>Suivi</div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--ink-3)',
            marginTop: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Dr. {shortId(c.practitionerId)}
        </div>
      </div>

      <div
        className="tnum"
        style={{
          fontSize: 12.5,
          color: statut === 'en-cours' ? 'var(--primary)' : 'var(--ink-2)',
          fontWeight: statut === 'en-cours' ? 600 : 500,
          textAlign: 'right',
        }}
      >
        {dur !== null ? `${dur} min` : '—'}
      </div>

      <div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 8px',
            borderRadius: 10,
            background: statutBadge.bg,
            color: statutBadge.fg,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {statutBadge.dot && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: statutBadge.fg,
                animation: 'cs-pulse 1.4s ease-in-out infinite',
              }}
            />
          )}
          {statutBadge.label}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {c.status === 'SIGNEE' ? (
          <>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 10.5,
                fontWeight: 600,
                color: 'var(--ink-2)',
                padding: '2px 6px',
                background: 'var(--bg-alt)',
                border: '1px solid var(--border)',
                borderRadius: 3,
              }}
            >
              <Doc /> Ordo
            </span>
            <Lock aria-hidden="true" />
          </>
        ) : (
          <span style={{ fontSize: 10.5, color: 'var(--ink-4)' }}>—</span>
        )}
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ConsultationsListPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { consultations, isLoading, error } = useConsultations();
  const [seg, setSeg] = useState<SegmentKey>('toutes');
  const [selected, setSelected] = useState<string | null>(null);

  const today = useMemo(() => dateKey(new Date().toISOString()), []);
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dateKey(d.toISOString());
  }, []);
  const thisWeekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return dateKey(d.toISOString());
  }, []);

  const kpis = useMemo(() => computeKpis(consultations, today), [consultations, today]);

  // Counts for the segmented control (always reflect the full dataset, not the filter).
  const counts = useMemo(() => {
    const t = consultations.filter((c) => dateKey(c.startedAt) === today).length;
    const w = consultations.filter((c) => dateKey(c.startedAt) >= thisWeekStart).length;
    const inProgress = consultations.filter(
      (c) => c.status === 'BROUILLON' || c.status === 'SUSPENDUE',
    ).length;
    return { all: consultations.length, today: t, week: w, inProgress, cancelled: 0 };
  }, [consultations, today, thisWeekStart]);

  const filtered = useMemo(() => {
    if (seg === 'aujourdhui') return consultations.filter((c) => dateKey(c.startedAt) === today);
    if (seg === 'semaine') return consultations.filter((c) => dateKey(c.startedAt) >= thisWeekStart);
    if (seg === 'en-cours')
      return consultations.filter((c) => c.status === 'BROUILLON' || c.status === 'SUSPENDUE');
    if (seg === 'annulees') return [];
    return consultations;
  }, [seg, consultations, today, thisWeekStart]);

  const groupedByDay = useMemo(() => {
    const groups = new Map<string, ConsultationApi[]>();
    for (const c of filtered) {
      const k = dateKey(c.startedAt);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(c);
    }
    // Sort by day descending, then each group by startedAt descending.
    return [...groups.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([k, items]) => [k, items.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))] as const);
  }, [filtered]);

  const segs: { id: SegmentKey; label: string; count: number }[] = [
    { id: 'toutes', label: 'Toutes', count: counts.all },
    { id: 'aujourdhui', label: "Aujourd'hui", count: counts.today },
    { id: 'semaine', label: 'Cette semaine', count: counts.week },
    { id: 'en-cours', label: 'En cours', count: counts.inProgress },
    { id: 'annulees', label: 'Annulées', count: counts.cancelled },
  ];

  // ── Mobile : on garde la liste cards simple ──────────────────────────────
  if (isMobile) {
    const drafts = consultations.filter((c) => c.status === 'BROUILLON');
    const signed = consultations.filter((c) => c.status === 'SIGNEE');
    return (
      <MScreen
        tab="menu"
        onTabChange={(t) => navigate(TAB_MAP[t])}
        topbar={
          <MTopbar
            left={<MIconBtn icon="ChevronLeft" label="Retour" onClick={() => navigate('/parametres')} />}
            title="Mes consultations"
            sub={`${consultations.length} consultation${consultations.length > 1 ? 's' : ''}`}
          />
        }
        fab={
          <button
            type="button"
            onClick={() => navigate('/patients')}
            aria-label="Démarrer depuis un patient"
            style={{
              position: 'fixed',
              right: 16,
              bottom: 76,
              padding: '10px 16px',
              borderRadius: 999,
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              cursor: 'pointer',
              zIndex: 5,
            }}
          >
            + Depuis patient
          </button>
        }
      >
        <div style={{ padding: 12 }}>
          {isLoading && <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</div>}
          {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
          {drafts.length > 0 && (
            <Panel style={{ marginBottom: 16 }}>
              <PanelHeader>
                <span>En cours · brouillon ({drafts.length})</span>
              </PanelHeader>
              <div style={{ padding: 12 }}>
                {drafts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => navigate(`/consultations/${c.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 6, marginBottom: 6, cursor: 'pointer',
                      textAlign: 'left', fontFamily: 'inherit', width: '100%',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{formatId(c)}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                        Patient {shortId(c.patientId)} · {formatHeure(c.startedAt)}
                      </div>
                      {c.motif && (
                        <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4 }}>{c.motif}</div>
                      )}
                    </div>
                    <Pill status="consult" dot>Brouillon</Pill>
                    <ChevronRight aria-hidden="true" />
                  </button>
                ))}
              </div>
            </Panel>
          )}
          {signed.length > 0 && (
            <Panel>
              <PanelHeader>
                <span>Signées ({signed.length})</span>
              </PanelHeader>
              <div style={{ padding: 12 }}>
                {signed.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => navigate(`/consultations/${c.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 6, marginBottom: 6, cursor: 'pointer',
                      textAlign: 'left', fontFamily: 'inherit', width: '100%',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{formatId(c)}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                        Patient {shortId(c.patientId)} · {formatHeure(c.startedAt)}
                      </div>
                    </div>
                    <Pill status="done" dot>Signée</Pill>
                    <Lock aria-hidden="true" />
                    <ChevronRight aria-hidden="true" />
                  </button>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </MScreen>
    );
  }

  // ── Desktop : iso-prototype ──────────────────────────────────────────────
  return (
    <Screen
      active="consult"
      title="Consultations"
      sub={`Historique · ${consultations.length} consultation${consultations.length > 1 ? 's' : ''} · ${counts.inProgress} en cours`}
      topbarRight={
        <>
          <Button>
            <File /> Export
          </Button>
          <Button variant="primary" onClick={() => navigate('/patients')}>
            <Plus /> Nouvelle consultation
          </Button>
        </>
      }
      onNavigate={(navId) => navigate(NAV_MAP[navId])}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* KPI strip */}
        <div
          style={{
            padding: '14px 20px 6px',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <KpiCard
            label="Aujourd'hui"
            value={String(kpis.todayCount)}
            sub={`${kpis.todayInProgress} en cours · ${kpis.todayDone} terminée${kpis.todayDone > 1 ? 's' : ''}`}
          />
          {kpis.avgDuration !== null ? (
            <KpiCard
              label="Durée moyenne"
              value={String(kpis.avgDuration)}
              unit="min"
              sub="cible 25 min"
            />
          ) : (
            <KpiCard label="Durée moyenne" value="—" sub="cible 25 min" />
          )}
          <KpiCard label="Taux ordonnance" value="—" unit="%" sub="à venir" />
          <KpiCard label="Annulations · 30j" value="—" sub="à venir" />
        </div>

        {/* Toolbar row 1 : segmented + sort */}
        <div
          style={{
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border-soft)',
            marginTop: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 2,
              background: 'var(--bg-alt)',
              padding: 2,
              borderRadius: 6,
              height: 30,
            }}
            role="tablist"
            aria-label="Segments"
          >
            {segs.map((s) => {
              const on = seg === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setSeg(s.id)}
                  style={{
                    padding: '0 11px',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    background: on ? 'var(--surface)' : 'transparent',
                    color: on ? 'var(--ink)' : 'var(--ink-3)',
                    fontWeight: on ? 600 : 500,
                    fontSize: 12.5,
                    boxShadow: on ? '0 0 0 1px var(--border)' : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 26,
                    fontFamily: 'inherit',
                  }}
                >
                  {s.label}
                  <span
                    className="tnum"
                    style={{
                      fontSize: 10.5,
                      color: on ? 'var(--ink-3)' : 'var(--ink-4)',
                      fontWeight: 600,
                    }}
                  >
                    {s.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--ink-3)',
              fontSize: 12,
              height: 30,
            }}
          >
            <span>Trier par</span>
            <button
              type="button"
              style={{
                height: 28,
                padding: '0 10px',
                border: '1px solid var(--border)',
                borderRadius: 14,
                background: 'var(--surface)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11.5,
                cursor: 'pointer',
                color: 'var(--ink)',
                fontWeight: 600,
                fontFamily: 'inherit',
              }}
            >
              Date · plus récent
              <ChevronDown />
            </button>
          </div>
        </div>

        {/* Toolbar row 2 : filter chips */}
        <div
          style={{
            padding: '8px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--ink-4)',
              marginRight: 4,
            }}
          >
            Filtres
          </span>
          <FilterChip label="Médecin" value="Tous" />
          <FilterChip label="Type" value="Tous" />
          <FilterChip label="Période" value="7 derniers jours" />
          <FilterChip label="Diagnostic CIM-10" value="—" muted />
          <button
            type="button"
            style={{
              marginLeft: 4,
              color: 'var(--ink-3)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 11.5,
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Plus /> Ajouter un filtre
          </button>
        </div>

        {/* Tables */}
        <div className="scroll" style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
          <div style={{ padding: '0 20px' }}>
            {isLoading && (
              <div style={{ padding: 32, color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</div>
            )}
            {error && (
              <div style={{ padding: 32, color: 'var(--danger)', fontSize: 13 }}>{error}</div>
            )}
            {!isLoading && filtered.length === 0 && !error && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
                Aucune consultation ne correspond à ce filtre.
              </div>
            )}

            {groupedByDay.map(([key, items]) => (
              <div key={key}>
                <DayHeader label={dayLabel(key, today, yesterday)} count={items.length} />
                <Panel style={{ margin: '0 0 18px', padding: 0, overflow: 'hidden' }}>
                  <TableHeader />
                  {items.map((c, i) => (
                    <ConsultationRow
                      key={c.id}
                      c={c}
                      last={i === items.length - 1}
                      selected={selected === c.id}
                      onClick={() => {
                        setSelected(c.id);
                        navigate(`/consultations/${c.id}`);
                      }}
                    />
                  ))}
                </Panel>
              </div>
            ))}

            {filtered.length > 0 && (
              <div
                style={{
                  padding: '8px 4px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 11.5,
                  color: 'var(--ink-3)',
                }}
              >
                <span>
                  Affichage de{' '}
                  <strong style={{ color: 'var(--ink-2)' }}>{filtered.length}</strong>{' '}
                  consultation{filtered.length > 1 ? 's' : ''} sur {consultations.length}
                </span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Button size="sm">
                    <ChevronLeft />
                  </Button>
                  <span className="tnum">Page 1 / 1</span>
                  <Button size="sm">
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Screen>
  );
}
