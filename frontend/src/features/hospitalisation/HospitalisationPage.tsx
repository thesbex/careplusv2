/**
 * Écran « Patients hospitalisés » (desktop) — refonte 2026-05-28.
 *
 * Worklist des séjours EN_COURS + admission + transfert + sortie + facturation
 * (Slice B+D), enrichie d'une barre KPI (lits occupés/libres, patients,
 * durée moyenne) + filtres (recherche patient, ward) + cards riches.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Input';
import { Plus } from '@/components/icons';
import { useT } from '@/lib/i18n/I18nProvider';
import { AdmissionForm, StayDetailPanel } from './components/StayPanels';
import { BedWall } from './components/BedWall';
import { useStayQueue, type StayQueueEntry } from './hooks/useStays';
import { useBedBoard } from './hooks/useHospitalization';
import { usePractitioners } from '@/features/agenda/hooks/usePractitioners';

const NAV_MAP = {
  dashboard: '/dashboard', agenda: '/agenda', patients: '/patients', salle: '/salle',
  consult: '/consultations', factu: '/facturation', vaccinations: '/vaccinations',
  grossesses: '/grossesses', stock: '/stock', queueLab: '/queue/lab', queueRadio: '/queue/radio',
  messages: '/messages', catalogue: '/catalogue', params: '/parametres', sejours: '/hospitalisation',
} as const;

/** Code couleur stable par médecin (mirror agenda multi-doctor). */
const DOCTOR_PALETTE = ['#1E4DAB', '#2F8F6B', '#C68A2E', '#C2553A', '#5A4FCF'];

/** Pastille de statut de séjour (worklist + historique). `labelKey` résolu via t(). */
const STAY_STATUS_META: Record<string, { labelKey: string; bg: string; fg: string }> = {
  EN_COURS: { labelKey: 'hospit.status.EN_COURS', bg: 'var(--primary-soft)', fg: 'var(--primary)' },
  SORTI: { labelKey: 'hospit.status.SORTI', bg: 'var(--amber-soft)', fg: '#6e4a0a' },
  FACTURE: { labelKey: 'hospit.status.FACTURE', bg: 'var(--success-soft)', fg: '#0a4630' },
  ANNULE: { labelKey: 'hospit.status.ANNULE', bg: '#e1ded2', fg: '#595549' },
};

function StayCard({
  stay,
  doctorMeta,
  onOpen,
  isSelected,
}: {
  stay: StayQueueEntry;
  doctorMeta?: { name: string; color: string; initials: string };
  onOpen: () => void;
  isSelected: boolean;
}) {
  const { t } = useT();
  const initials = `${stay.patientFirstName.charAt(0)}${stay.patientLastName.charAt(0)}`.toUpperCase();
  const fullName = `${stay.patientLastName} ${stay.patientFirstName}`;
  const meta = STAY_STATUS_META[stay.status];
  const statusMeta = meta
    ? { label: t(meta.labelKey), bg: meta.bg, fg: meta.fg }
    : { label: stay.status, bg: 'var(--bg-alt)', fg: 'var(--ink-3)' };
  const dayLabel = stay.status !== 'EN_COURS'
    ? (stay.dischargedAt ? t('hospit.card.dischargedOn', { date: new Date(stay.dischargedAt).toLocaleDateString('fr-MA') }) : statusMeta.label)
    : stay.daysSoFar === 0 ? t('hospit.card.admittedToday') : t('hospit.card.day', { n: stay.daysSoFar + 1 });
  return (
    <button
      type="button"
      data-testid={`stay-row-${stay.stayId}`}
      onClick={onOpen}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '13px 16px',
        background: isSelected ? 'var(--primary-soft)' : 'var(--surface)',
        border: 'none',
        borderRadius: 14,
        boxShadow: isSelected
          ? 'inset 0 0 0 1px var(--primary)'
          : 'var(--ds2-shadow-sm, 0 1px 2px rgba(20,30,50,.04), 0 8px 20px -16px rgba(20,30,50,.22))',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'background 0.12s ease, box-shadow 0.12s ease',
      }}
    >
      {/* Avatar patient (initiales) */}
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: 'var(--ds2-navy, var(--primary))', color: '#fff',
        display: 'grid', placeItems: 'center',
        fontWeight: 700, fontSize: 13, letterSpacing: 0.02,
        flexShrink: 0,
      }}>
        {initials}
      </div>

      {/* Identité + motif */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 650 }}>{fullName}</span>
          <span style={{
            fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
            background: statusMeta.bg, color: statusMeta.fg,
          }}>
            {statusMeta.label}
          </span>
          {doctorMeta && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11, color: 'var(--ds2-ink-3, var(--ink-3))',
              padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 999,
            }}>
              <span style={{
                width: 16, height: 16, borderRadius: '50%',
                background: doctorMeta.color, color: '#fff',
                display: 'grid', placeItems: 'center',
                fontSize: 9, fontWeight: 700,
              }}>
                {doctorMeta.initials}
              </span>
              {doctorMeta.name}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {stay.admissionReason ?? t('hospit.card.noReason')}
        </div>
      </div>

      {/* Bed / ward chip */}
      <div style={{
        display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2,
        fontSize: 11, color: 'var(--ink-3)', minWidth: 130,
      }}>
        <span style={{ fontWeight: 600, color: 'var(--ink-2)', fontSize: 12 }}>
          {stay.bedLabel ?? '—'}{stay.wardLabel ? ` · ${stay.wardLabel}` : ''}
        </span>
        <span className="tnum">{dayLabel}</span>
      </div>

      {/* CTA */}
      <span style={{
        fontSize: 12, fontWeight: 700,
        color: 'var(--primary)',
        padding: '7px 13px', border: 'none',
        background: 'var(--primary-soft)',
        borderRadius: 999,
      }}>
        {isSelected ? t('hospit.card.open') : t('hospit.card.manage')}
      </span>
    </button>
  );
}

function KpiTile({ label, value, sub, hero, dot }: { label: string; value: string; sub?: string; hero?: boolean; dot?: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden',
      background: 'var(--surface)', border: 'none',
      borderRadius: 16, boxShadow: 'var(--ds2-shadow-sm, 0 1px 2px rgba(20,30,50,.04), 0 10px 34px -20px rgba(20,30,50,.2))',
      padding: '16px 18px',
    }}>
      {hero && (
        <span style={{ position: 'absolute', left: 0, top: 0, right: 0, height: 3, background: 'var(--primary)' }} />
      )}
      <div style={{
        fontSize: 12, color: hero ? 'var(--primary)' : 'var(--ink-3)', fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />}
        {label}
      </div>
      <div className="tnum" style={{
        fontSize: 27, fontWeight: 800, color: 'var(--ink)',
        letterSpacing: '-0.03em', marginTop: 8, lineHeight: 1,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 7, fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

export default function HospitalisationPage() {
  const navigate = useNavigate();
  const { t } = useT();
  const { stays: rawStays } = useStayQueue(); // EN_COURS — base des KPI + mur de lits
  const { board } = useBedBoard();
  const { data: practitioners } = usePractitioners();
  const [admitting, setAdmitting] = useState(false);
  const [openStay, setOpenStay] = useState<string | null>(null);
  // Bascule worklist / mur de lits (refresh — vue additionnelle).
  const [view, setView] = useState<'liste' | 'mur'>('liste');
  // Statut affiché dans la liste : en cours (défaut) / historique clôturé / tous.
  const [statusSeg, setStatusSeg] = useState<'encours' | 'historique' | 'tous'>('encours');
  const statusesParam =
    statusSeg === 'historique' ? 'SORTI,FACTURE,ANNULE'
      : statusSeg === 'tous' ? 'EN_COURS,SORTI,FACTURE,ANNULE'
        : undefined;
  const { stays: listStays, isLoading, error } = useStayQueue(statusesParam);

  // Filtres user 2026-05-28 : recherche patient + ward (+ médecin 2026-05-29).
  const [search, setSearch] = useState('');
  const [wardFilter, setWardFilter] = useState<string>('ALL');
  const [medecinFilter, setMedecinFilter] = useState<string>('ALL');

  // Pastille couleur + initiales par médecin pour les cards (mirror agenda).
  const practitionerMap = useMemo(() => {
    const m: Record<string, { initials: string; color: string; name: string }> = {};
    (practitioners ?? []).forEach((p, i) => {
      const fn = (p.firstName || '').trim();
      const ln = (p.lastName || '').trim();
      const initials = ((fn[0] ?? ln[0] ?? '?') + (ln[0] ?? fn[1] ?? '')).toUpperCase();
      m[p.id] = {
        initials,
        color: DOCTOR_PALETTE[i % DOCTOR_PALETTE.length] ?? '#1E4DAB',
        name: `Dr ${ln}`,
      };
    });
    return m;
  }, [practitioners]);

  // KPI computed sur board + stays.
  const allBeds = useMemo(
    () => board.wards.flatMap((w) => w.rooms.flatMap((r) => r.beds.filter((b) => b.active))),
    [board],
  );
  const occupied = allBeds.filter((b) => b.status === 'OCCUPE').length;
  const total = allBeds.length;
  const free = Math.max(0, total - occupied);
  const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
  const avgDays = rawStays.length > 0
    ? (rawStays.reduce((s, st) => s + st.daysSoFar, 0) / rawStays.length).toFixed(1)
    : '—';
  const todayAdmits = rawStays.filter((s) => s.daysSoFar === 0).length;

  // Wards visibles (depuis le board, plus fiable que dériver des stays).
  const wards = board.wards;

  // Application des filtres (sur la liste selon le statut sélectionné).
  const stays = useMemo(() => {
    let out = listStays;
    if (wardFilter !== 'ALL') out = out.filter((s) => s.wardLabel === wardFilter);
    if (medecinFilter !== 'ALL') out = out.filter((s) => s.attendingPractitionerId === medecinFilter);
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      out = out.filter(
        (s) =>
          `${s.patientLastName} ${s.patientFirstName}`.toLowerCase().includes(needle) ||
          (s.admissionReason ?? '').toLowerCase().includes(needle) ||
          (s.bedLabel ?? '').toLowerCase().includes(needle),
      );
    }
    return out;
  }, [listStays, wardFilter, medecinFilter, search]);

  const hasActiveFilter = !!search.trim() || wardFilter !== 'ALL' || medecinFilter !== 'ALL';

  // Médecins présents dans la liste affichée (pour le filtre).
  const stayDoctors = useMemo(() => {
    const ids = new Set(listStays.map((s) => s.attendingPractitionerId).filter(Boolean) as string[]);
    return (practitioners ?? []).filter((p) => ids.has(p.id));
  }, [listStays, practitioners]);

  return (
    <Screen
      active="sejours"
      title={t('hospit.title')}
      sub={t(rawStays.length > 1 ? 'hospit.subPlural' : 'hospit.sub', { n: rawStays.length, occupied, total })}
      topbarRight={
        <Button
          className="cp-ds2-primary"
          onClick={() => { setAdmitting((v) => !v); setOpenStay(null); }}
        >
          <Plus /> {admitting ? t('hospit.close') : t('hospit.newAdmission')}
        </Button>
      }
      onNavigate={(id) => navigate(NAV_MAP[id])}
    >
      <div style={{ padding: 24, overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }} className="scroll">
        {/* Bascule Liste / Mur de lits (refresh) */}
        <div role="tablist" aria-label={t('hospit.viewAria')} style={{ display: 'flex', gap: 2, background: 'var(--bg-alt)', padding: 2, borderRadius: 8, alignSelf: 'flex-start' }}>
          {(['liste', 'mur'] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
              style={{
                padding: '7px 16px', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 12.5, fontWeight: view === v ? 600 : 500,
                background: view === v ? 'var(--surface)' : 'transparent',
                color: view === v ? 'var(--ink)' : 'var(--ink-3)',
                boxShadow: view === v ? '0 0 0 1px var(--border)' : 'none',
              }}>
              {v === 'liste' ? t('hospit.view.liste') : t('hospit.view.mur')}
            </button>
          ))}
        </div>

        {/* Admission + détail séjour : partagés par les deux vues */}
        {admitting && (
          <>
            <AdmissionForm onDone={() => setAdmitting(false)} />
            <div style={{ height: 0 }} />
          </>
        )}
        {openStay && (
          <>
            <StayDetailPanel stayId={openStay} onClose={() => setOpenStay(null)} />
            <div style={{ height: 0 }} />
          </>
        )}

        {view === 'mur' && (
          <BedWall onOpenStay={(stayId) => { setOpenStay(stayId); setAdmitting(false); }} />
        )}

        {view === 'liste' && (
          <>
        {/* Segment statut : revenir sur l'historique des séjours clôturés. */}
        <div role="tablist" aria-label={t('hospit.statusSegAria')}
          style={{ display: 'flex', gap: 2, background: 'var(--bg-alt)', padding: 2, borderRadius: 8, alignSelf: 'flex-start' }}>
          {([['encours', 'hospit.seg.encours'], ['historique', 'hospit.seg.historique'], ['tous', 'hospit.seg.tous']] as const).map(([k, labelKey]) => (
            <button key={k} type="button" role="tab" aria-selected={statusSeg === k} onClick={() => setStatusSeg(k)}
              style={{
                padding: '6px 14px', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 12.5, fontWeight: statusSeg === k ? 600 : 500,
                background: statusSeg === k ? 'var(--surface)' : 'transparent',
                color: statusSeg === k ? 'var(--ink)' : 'var(--ink-3)',
                boxShadow: statusSeg === k ? '0 0 0 1px var(--border)' : 'none',
              }}>
              {t(labelKey)}
            </button>
          ))}
        </div>
        {/* KPI bar — refonte 2026-05-28 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 4 }}>
          <KpiTile
            hero
            label={t('hospit.kpi.inpatients')}
            value={String(rawStays.length)}
            sub={todayAdmits > 0
              ? t(todayAdmits > 1 ? 'hospit.kpi.admitsTodayPlural' : 'hospit.kpi.admitsToday', { n: todayAdmits })
              : t('hospit.kpi.noAdmitsToday')}
          />
          <KpiTile
            label={t('hospit.kpi.bedsOccupied')}
            dot="var(--danger)"
            value={total > 0 ? `${occupied} / ${total}` : '—'}
            sub={total > 0 ? t('hospit.kpi.occupancyRate', { n: occupancyRate }) : t('hospit.kpi.noBeds')}
          />
          <KpiTile
            label={t('hospit.kpi.bedsFree')}
            dot="var(--success)"
            value={String(free)}
            sub={free === 0 && total > 0 ? t('hospit.kpi.full') : t('hospit.kpi.availableForAdmission')}
          />
          <KpiTile
            label={t('hospit.kpi.avgStay')}
            dot="var(--amber)"
            value={avgDays === '—' ? '—' : t('hospit.kpi.days', { n: avgDays })}
            sub={t('hospit.kpi.currentPatients')}
          />
        </div>

        {/* Barre filtres */}
        <Panel style={{ padding: '12px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
              <span style={{ color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('hospit.filter.search')}
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('hospit.filter.searchPlaceholder')}
                aria-label={t('hospit.filter.searchAria')}
                style={{
                  height: 32, padding: '0 8px',
                  border: '1px solid var(--border)', borderRadius: 6,
                  fontFamily: 'inherit', fontSize: 12.5, background: 'var(--surface)',
                }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
              <span style={{ color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('hospit.filter.ward')}
              </span>
              <Select
                value={wardFilter}
                onChange={(e) => setWardFilter(e.target.value)}
                aria-label={t('hospit.filter.wardAria')}
                style={{
                  height: 32, padding: '0 8px',
                  border: '1px solid var(--border)', borderRadius: 6,
                  fontFamily: 'inherit', fontSize: 12.5, background: 'var(--surface)',
                }}
              >
                <option value="ALL">{t('hospit.filter.allWards')}</option>
                {wards.map((w) => (
                  <option key={w.wardId} value={w.wardLabel}>{w.wardLabel}</option>
                ))}
              </Select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
              <span style={{ color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('hospit.filter.doctor')}
              </span>
              <Select
                value={medecinFilter}
                onChange={(e) => setMedecinFilter(e.target.value)}
                aria-label={t('hospit.filter.doctorAria')}
                style={{
                  height: 32, padding: '0 8px',
                  border: '1px solid var(--border)', borderRadius: 6,
                  fontFamily: 'inherit', fontSize: 12.5, background: 'var(--surface)',
                }}
              >
                <option value="ALL">{t('hospit.filter.allDoctors')}</option>
                {stayDoctors.map((p) => (
                  <option key={p.id} value={p.id}>Dr {p.lastName}</option>
                ))}
              </Select>
            </label>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => { setSearch(''); setWardFilter('ALL'); setMedecinFilter('ALL'); }}
                style={{
                  height: 32, padding: '0 12px',
                  background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                  cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--primary)',
                }}
              >
                {t('hospit.filter.reset')}
              </button>
            )}
          </div>
          {hasActiveFilter && (
            <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink-3)' }}>
              {t(stays.length > 1 ? 'hospit.filter.resultsPlural' : 'hospit.filter.results', { n: stays.length, total: listStays.length })}
            </div>
          )}
        </Panel>

        {/* Liste séjours en cards riches */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {isLoading && (
            <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: 16 }}>{t('hospit.list.loading')}</div>
          )}
          {error && (
            <div style={{ color: 'var(--danger)', fontSize: 13, padding: 16 }}>{t(error)}</div>
          )}
          {!isLoading && listStays.length === 0 && (
            <Panel style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                {statusSeg === 'encours'
                  ? t('hospit.list.emptyEncours')
                  : t('hospit.list.emptyHistorique')}
              </div>
            </Panel>
          )}
          {!isLoading && listStays.length > 0 && stays.length === 0 && (
            <Panel style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                {t('hospit.list.noMatch')}
              </div>
            </Panel>
          )}
          {stays.map((s) => (
            <StayCard
              key={s.stayId}
              stay={s}
              {...(s.attendingPractitionerId && practitionerMap[s.attendingPractitionerId]
                ? { doctorMeta: practitionerMap[s.attendingPractitionerId] }
                : {})}
              isSelected={openStay === s.stayId}
              onOpen={() => { setOpenStay(s.stayId === openStay ? null : s.stayId); setAdmitting(false); }}
            />
          ))}
        </div>
          </>
        )}
      </div>
    </Screen>
  );
}
