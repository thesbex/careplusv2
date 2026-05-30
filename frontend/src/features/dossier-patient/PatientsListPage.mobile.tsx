/**
 * Patients list — mobile (refonte 2026-05-10).
 *
 * Design source: design/prototype/mobile/liste-patients.jsx (M05a). Layout:
 * - Topbar Patients · N dossiers + Filter icon
 * - Inline search (Nom, téléphone, CIN…)
 * - Pill segmented control [Tous | Chroniques | Nouveaux] (horizontal scroll)
 * - Result count + Trier dropdown
 * - List grouped by first letter (sticky-like headers)
 * - Row: avatar + name + amber allergy badge + Grossesse / Nouveau pills,
 *   age · gender · top-2 chronic tags, "Vu:" rel + "→ next" if any
 * - FAB bottom-right for création (NewPatientMobileSheet)
 *
 * NewPatientMobileSheet (créé 2026-05-01) reste la voie de création sur mobile —
 * version condensée des champs essentiels. Les sections denses
 * (allergies/antécédents/mutuelle/historique) restent côté desktop.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { ChevronDown, ChevronRight, Plus, Search, Warn } from '@/components/icons';
import { useAuthStore } from '@/lib/auth/authStore';
import { useT } from '@/lib/i18n/I18nProvider';
import { usePatientList, type PatientListItem, type Segment } from './hooks/usePatientList';
import { NewPatientMobileSheet } from './components/NewPatientMobileSheet';

type T = (key: string, vars?: Record<string, string | number>) => string;

function toAge(birthDate: string): number {
  const d = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

const TAB_MAP: Record<MobileTab, string> = {
  agenda:   '/agenda',
  salle:    '/salle',
  patients: '/patients',
  factu:    '/facturation',
  menu:     '/parametres',
};

const AVATAR_PALETTE: readonly string[] = ['#1E5AA8', '#2A7CE7', '#6B6B6B', '#3F7A3A', '#B8500C'];
function avatarColor(id: string): string {
  const idx = id.charCodeAt(id.length - 1) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx] ?? '#2A7CE7';
}

function relativeShort(iso: string | null | undefined, t: T): string {
  if (!iso) return t('dossier.mlist.relNew');
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return '';
  if (days < 1) return t('dossier.mlist.relToday');
  if (days === 1) return t('dossier.mlist.relYesterday');
  if (days < 14) return t('dossier.mlist.relDays', { n: days });
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return t('dossier.mlist.relWeeks', { n: weeks });
  const months = Math.floor(days / 30);
  if (months < 12) return t('dossier.mlist.relMonths', { n: months });
  return '';
}

function shortDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

function MPatientRow({
  p,
  isFirst,
  onOpen,
}: {
  p: PatientListItem;
  isFirst: boolean;
  onOpen: () => void;
}) {
  const { t } = useT();
  const initials = `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();
  const nextLabel = shortDateTime(p.nextAppointmentAt);
  const lastLabel = relativeShort(p.lastVisitAt, t);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="m-row"
      style={{
        width: '100%',
        textAlign: 'left',
        background: 'var(--surface)',
        border: 0,
        borderTop: isFirst ? 'none' : '1px solid var(--border-soft)',
        fontFamily: 'inherit',
        font: 'inherit',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        className="cp-avatar"
        aria-hidden="true"
        style={{
          background: avatarColor(p.id),
          width: 40,
          height: 40,
          borderRadius: 10,
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Line 1 — name + badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>
            {p.firstName} {p.lastName}
          </span>
          {p.allergy && (
            <span
              title={t('dossier.mlist.allergyKnown')}
              aria-label={t('dossier.mlist.allergyKnown')}
              style={{
                width: 16, height: 16, borderRadius: '50%',
                background: 'var(--amber-soft)', color: 'var(--amber)',
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}
            >
              <span style={{ transform: 'scale(0.7)', display: 'inline-flex' }}>
                <Warn />
              </span>
            </span>
          )}
          {p.pregnant && (
            <span
              className="m-pill"
              style={{
                fontSize: 10,
                padding: '1px 6px',
                background: '#FDE6EE',
                color: '#9A2A52',
              }}
            >
              {t('dossier.mlist.pregnancy')}
            </span>
          )}
          {p.isNew && (
            <span
              className="m-pill"
              style={{
                fontSize: 10,
                padding: '1px 6px',
                background: 'var(--primary-soft)',
                color: 'var(--primary)',
              }}
            >
              {t('dossier.mlist.new')}
            </span>
          )}
          {p.tier === 'PREMIUM' && (
            <span
              className="m-pill"
              aria-label={t('dossier.mlist.premiumAria')}
              style={{
                fontSize: 10,
                padding: '1px 6px',
                background: 'var(--amber-soft)',
                color: 'var(--amber)',
              }}
            >
              {t('dossier.mlist.premium')}
            </span>
          )}
        </div>
        {/* Line 2 — age · gender + top tags */}
        <div
          style={{
            fontSize: 11.5,
            color: 'var(--ink-3)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span className="tnum">
            {p.birthDate ? `${toAge(p.birthDate)} ${t('dossier.years')}` : '—'}
            {' · '}
            {p.gender === 'M' ? t('dossier.mlist.male') : p.gender === 'F' ? t('dossier.mlist.female') : '—'}
          </span>
          {p.tags && p.tags.length > 0 && (
            <>
              <span style={{ color: 'var(--ink-4)' }}>·</span>
              <span
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: 'var(--ink-2)',
                  fontWeight: 500,
                  minWidth: 0,
                }}
              >
                {p.tags.slice(0, 2).join(', ')}
              </span>
            </>
          )}
        </div>
        {/* Line 3 — last visit + next RDV */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            <span style={{ color: 'var(--ink-4)' }}>{t('dossier.mlist.seen')}</span>
            <span className="tnum" style={{ color: 'var(--ink-2)', fontWeight: 500 }}>
              {lastLabel}
            </span>
          </span>
          {nextLabel && (
            <span
              className="tnum"
              style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}
            >
              → {nextLabel}
            </span>
          )}
        </div>
      </div>
      <span style={{ color: 'var(--ink-4)', flexShrink: 0 }}>
        <ChevronRight aria-hidden="true" />
      </span>
    </button>
  );
}

export default function PatientsListMobilePage() {
  const { t } = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Mode "picker" — appelé depuis /rdv/new pour choisir un patient. Clic sur
  // une ligne → retour au form RDV avec patientId pré-rempli, au lieu du
  // dossier patient (qui faisait perdre le brouillon RDV).
  const pickerMode = searchParams.get('picker'); // 'rdv' | null
  const isRdvPicker = pickerMode === 'rdv';
  const [q, setQ] = useState('');
  const [seg, setSeg] = useState<Segment>('tous');
  const [showNew, setShowNew] = useState(false);

  function handlePickPatient(p: { id: string; firstName?: string; lastName?: string }) {
    if (isRdvPicker) {
      const name = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
      navigate(`/rdv/new?patientId=${p.id}${name ? `&patientName=${encodeURIComponent(name)}` : ''}`);
    } else {
      navigate(`/patients/${p.id}`);
    }
  }

  const { patients, total, counts, isLoading, error } = usePatientList({
    q,
    segment: seg,
    size: 100,
  });

  // QA3-3 — back-compat gate on PATIENT_CREATE.
  const userPerms = useAuthStore((s) => s.user?.permissions);
  const canCreatePatient = userPerms == null || userPerms.includes('PATIENT_CREATE');

  // Group rows by first letter of last name (FR locale uppercase).
  const groups = useMemo(() => {
    const map = new Map<string, PatientListItem[]>();
    patients.forEach((p) => {
      const letter = (p.lastName || '?').charAt(0).toLocaleUpperCase('fr-FR');
      const arr = map.get(letter) ?? [];
      arr.push(p);
      map.set(letter, arr);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'fr'));
  }, [patients]);

  const segMobile = [
    { id: 'tous' as Segment,        label: t('dossier.seg.tous'),        count: counts.tous },
    { id: 'chroniques' as Segment,  label: t('dossier.seg.chroniques'),  count: counts.chroniques },
    { id: 'nouveaux' as Segment,    label: t('dossier.seg.nouveaux'),    count: counts.nouveaux },
  ];

  return (
    <MScreen
      tab="patients"
      topbar={
        <MTopbar
          title={t('nav.patients')}
          sub={counts.tous !== 1 ? t('dossier.recordCountPlural', { count: counts.tous }) : t('dossier.recordCount', { count: counts.tous })}
          right={<MIconBtn icon="Filter" label={t('dossier.mlist.filters')} />}
        />
      }
      onTabChange={(tab) => navigate(TAB_MAP[tab])}
      fab={
        canCreatePatient ? (
          <button
            type="button"
            aria-label={t('dossier.mlist.newPatient')}
            onClick={() => setShowNew(true)}
            style={{
              position: 'fixed',
              right: 16,
              bottom: 76,
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: 0,
              background: 'var(--primary)',
              color: 'var(--on-primary, #fff)',
              boxShadow: '0 6px 20px rgba(42,124,231,0.4), 0 2px 4px rgba(0,0,0,0.08)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              zIndex: 30,
            }}
          >
            <Plus aria-hidden="true" />
          </button>
        ) : undefined
      }
    >
      {/* Search bar — m-search class kept so tests + token visual stay aligned. */}
      <div
        style={{
          padding: '12px 16px 8px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border-soft)',
        }}
      >
        <label
          className="m-search"
          style={{
            height: 38,
            background: 'var(--bg-alt)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            gap: 8,
            color: 'var(--ink-3)',
          }}
        >
          <Search aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('dossier.mlist.searchPlaceholder')}
            aria-label={t('dossier.mlist.searchAria')}
            style={{
              flex: 1,
              border: 0,
              outline: 'none',
              background: 'transparent',
              fontSize: 14,
              fontFamily: 'inherit',
              color: 'var(--ink)',
            }}
          />
        </label>
      </div>

      {/* Segmented pills — horizontal scroll if it overflows. */}
      <div
        role="tablist"
        aria-label={t('dossier.mlist.filtersAria')}
        style={{
          padding: '10px 16px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          gap: 8,
          overflow: 'auto',
        }}
      >
        {segMobile.map((s) => {
          const active = seg === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSeg(s.id)}
              style={{
                height: 30,
                padding: '0 12px',
                borderRadius: 15,
                border: '1px solid ' + (active ? 'var(--primary)' : 'var(--border)'),
                background: active ? 'var(--primary)' : 'var(--surface)',
                color: active ? '#fff' : 'var(--ink-2)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12.5,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                flexShrink: 0,
                fontFamily: 'inherit',
              }}
            >
              {s.label}
              <span
                className="tnum"
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: active ? 'rgba(255,255,255,0.75)' : 'var(--ink-4)',
                }}
              >
                {s.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Result count + sort placeholder */}
      <div
        style={{
          padding: '10px 16px 4px',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--ink-3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>
          {isLoading
            ? t('common.loading')
            : total > 1
            ? t('dossier.mlist.resultsPlural', { count: total })
            : t('dossier.mlist.results', { count: total })}
        </span>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: 500,
            textTransform: 'none',
            letterSpacing: 0,
            fontSize: 11.5,
            color: 'var(--ink-3)',
          }}
        >
          {t('dossier.mlist.sort')} <ChevronDown />
        </span>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', color: 'var(--danger)', fontSize: 13 }}>{error}</div>
      )}

      {/* Grouped list */}
      <div className="m-card" style={{ background: 'transparent', boxShadow: 'none' }}>
        {!isLoading && patients.length === 0 ? (
          <div
            style={{
              padding: '60px 24px',
              textAlign: 'center',
              color: 'var(--ink-3)',
              fontSize: 13,
            }}
          >
            {q
              ? t('dossier.mlist.emptySearch')
              : t('dossier.mlist.empty')}
          </div>
        ) : (
          groups.map(([letter, rows]) => (
            <div key={letter}>
              <div
                style={{
                  padding: '8px 16px',
                  background: 'var(--bg)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--ink-3)',
                  letterSpacing: '0.08em',
                  borderTop: '1px solid var(--border-soft)',
                  borderBottom: '1px solid var(--border-soft)',
                }}
              >
                {letter}
              </div>
              {rows.map((p, i) => (
                <MPatientRow
                  key={p.id}
                  p={p}
                  isFirst={i === 0}
                  onOpen={() => handlePickPatient(p)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      <div
        style={{
          margin: '16px 16px 24px',
          padding: 12,
          background: 'var(--bg-alt)',
          borderRadius: 'var(--r-lg)',
          fontSize: 12,
          color: 'var(--ink-3)',
          lineHeight: 1.5,
        }}
      >
        {t('dossier.mlist.tip')}
      </div>

      <NewPatientMobileSheet
        open={showNew}
        onOpenChange={setShowNew}
        onCreated={(id) => {
          setShowNew(false);
          // Si on est en picker RDV, on retourne au form RDV plutôt qu'au dossier.
          if (isRdvPicker) {
            navigate(`/rdv/new?patientId=${id}`);
          } else {
            navigate(`/patients/${id}`);
          }
        }}
      />
    </MScreen>
  );
}
