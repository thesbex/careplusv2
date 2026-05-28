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
import { AdmissionForm, StayDetailPanel } from './components/StayPanels';
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
  const initials = `${stay.patientFirstName.charAt(0)}${stay.patientLastName.charAt(0)}`.toUpperCase();
  const fullName = `${stay.patientLastName} ${stay.patientFirstName}`;
  const dayLabel = stay.daysSoFar === 0 ? 'Admis aujourd\'hui' : `Jour ${stay.daysSoFar + 1}`;
  return (
    <button
      type="button"
      data-testid={`stay-row-${stay.stayId}`}
      onClick={onOpen}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 16px',
        background: isSelected ? 'var(--ds2-navy-soft, var(--primary-soft))' : 'var(--surface)',
        border: `1px solid ${isSelected ? 'var(--ds2-navy, var(--primary))' : 'var(--border)'}`,
        borderRadius: 8,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'border-color 0.12s ease, box-shadow 0.12s ease',
      }}
    >
      {/* Avatar patient (initiales) */}
      <div style={{
        width: 38, height: 38, borderRadius: 8,
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
          {stay.admissionReason ?? 'Motif non renseigné'}
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
        fontSize: 12, fontWeight: 600,
        color: 'var(--ds2-navy, var(--primary))',
        padding: '6px 12px', border: '1px solid var(--ds2-navy, var(--primary))',
        borderRadius: 6,
      }}>
        {isSelected ? 'Ouvert' : 'Gérer →'}
      </span>
    </button>
  );
}

function KpiTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)', padding: '12px 14px',
    }}>
      <div style={{
        fontSize: 10.5, color: 'var(--ink-3)', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>{label}</div>
      <div className="tnum" style={{
        fontSize: 22, fontWeight: 700, color: 'var(--ds2-ink, var(--ink))',
        letterSpacing: '-0.02em', marginTop: 2,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function HospitalisationPage() {
  const navigate = useNavigate();
  const { stays: rawStays, isLoading, error } = useStayQueue();
  const { board } = useBedBoard();
  const { data: practitioners } = usePractitioners();
  const [admitting, setAdmitting] = useState(false);
  const [openStay, setOpenStay] = useState<string | null>(null);

  // Filtres user 2026-05-28 : recherche patient + ward.
  const [search, setSearch] = useState('');
  const [wardFilter, setWardFilter] = useState<string>('ALL');

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

  // Application des filtres.
  const stays = useMemo(() => {
    let out = rawStays;
    if (wardFilter !== 'ALL') out = out.filter((s) => s.wardLabel === wardFilter);
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
  }, [rawStays, wardFilter, search]);

  const hasActiveFilter = !!search.trim() || wardFilter !== 'ALL';

  return (
    <Screen
      active="sejours"
      title="Hospitalisation"
      sub={`${rawStays.length} patient${rawStays.length > 1 ? 's' : ''} hospitalisé${rawStays.length > 1 ? 's' : ''} · ${occupied}/${total} lits`}
      topbarRight={
        <Button
          className="cp-ds2-primary"
          onClick={() => { setAdmitting((v) => !v); setOpenStay(null); }}
        >
          <Plus /> {admitting ? 'Fermer' : 'Nouvelle admission'}
        </Button>
      }
      onNavigate={(id) => navigate(NAV_MAP[id])}
    >
      <div style={{ padding: 24, overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }} className="scroll">
        {/* KPI bar — refonte 2026-05-28 */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <KpiTile
            label="Patients hospitalisés"
            value={String(rawStays.length)}
            sub={todayAdmits > 0 ? `${todayAdmits} admission${todayAdmits > 1 ? 's' : ''} aujourd'hui` : 'aucune admission aujourd\'hui'}
          />
          <KpiTile
            label="Lits occupés"
            value={total > 0 ? `${occupied} / ${total}` : '—'}
            sub={total > 0 ? `${occupancyRate} % d'occupation` : 'aucun lit configuré'}
          />
          <KpiTile
            label="Lits libres"
            value={String(free)}
            sub={free === 0 && total > 0 ? 'complet' : `disponibles pour admission`}
          />
          <KpiTile
            label="Durée moyenne"
            value={avgDays === '—' ? '—' : `${avgDays} j`}
            sub="patients en cours"
          />
        </div>

        {/* Barre filtres */}
        <Panel style={{ padding: '12px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 10, alignItems: 'end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
              <span style={{ color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Rechercher
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nom patient, motif, lit…"
                aria-label="Rechercher un séjour"
                style={{
                  height: 32, padding: '0 8px',
                  border: '1px solid var(--border)', borderRadius: 6,
                  fontFamily: 'inherit', fontSize: 12.5, background: 'var(--surface)',
                }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
              <span style={{ color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Service
              </span>
              <Select
                value={wardFilter}
                onChange={(e) => setWardFilter(e.target.value)}
                aria-label="Filtrer par service"
                style={{
                  height: 32, padding: '0 8px',
                  border: '1px solid var(--border)', borderRadius: 6,
                  fontFamily: 'inherit', fontSize: 12.5, background: 'var(--surface)',
                }}
              >
                <option value="ALL">Tous les services</option>
                {wards.map((w) => (
                  <option key={w.wardId} value={w.wardLabel}>{w.wardLabel}</option>
                ))}
              </Select>
            </label>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => { setSearch(''); setWardFilter('ALL'); }}
                style={{
                  height: 32, padding: '0 12px',
                  background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                  cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--primary)',
                }}
              >
                Réinitialiser
              </button>
            )}
          </div>
          {hasActiveFilter && (
            <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink-3)' }}>
              {stays.length} résultat{stays.length > 1 ? 's' : ''} (sur {rawStays.length})
            </div>
          )}
        </Panel>

        {/* Forme admission */}
        {admitting && (
          <>
            <AdmissionForm onDone={() => setAdmitting(false)} />
            <div style={{ height: 0 }} />
          </>
        )}

        {/* Détail séjour ouvert */}
        {openStay && (
          <>
            <StayDetailPanel stayId={openStay} onClose={() => setOpenStay(null)} />
            <div style={{ height: 0 }} />
          </>
        )}

        {/* Liste séjours en cards riches */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {isLoading && (
            <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: 16 }}>Chargement…</div>
          )}
          {error && (
            <div style={{ color: 'var(--danger)', fontSize: 13, padding: 16 }}>{error}</div>
          )}
          {!isLoading && rawStays.length === 0 && (
            <Panel style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                Aucun patient hospitalisé. Cliquez sur « Nouvelle admission » pour démarrer un séjour.
              </div>
            </Panel>
          )}
          {!isLoading && rawStays.length > 0 && stays.length === 0 && (
            <Panel style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                Aucun séjour ne correspond aux filtres.
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
      </div>
    </Screen>
  );
}
