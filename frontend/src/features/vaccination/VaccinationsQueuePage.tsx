/**
 * /vaccinations — Worklist transversale (desktop).
 * Shows overdue, due-this-week, and due-this-month vaccination slots
 * for all paediatric patients. Route guarded: SECRETAIRE/ASSISTANT/MEDECIN/ADMIN.
 */
import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Avatar } from '@/components/ui/Avatar';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import {
  useVaccinationsQueue,
  type VaccinationQueueEntry,
  type VaccinationsQueueFilters,
} from './hooks/useVaccinationsQueue';
import { useVaccinationCatalog } from './hooks/useVaccinationCatalog';
import { RecordDoseDrawer } from './components/RecordDoseDrawer';
import type { VaccinationCalendarEntry } from './types';

const NAV_MAP = {
  agenda: '/agenda',
  patients: '/patients',
  salle: '/salle',
  consult: '/consultations',
  factu: '/facturation',
  vaccinations: '/vaccinations',
  grossesses: '/grossesses',
  stock: '/stock',
  catalogue: '/catalogue',
  params: '/parametres',
} as const;

type TabStatus = 'OVERDUE' | 'DUE_SOON' | 'UPCOMING';

const TABS: { id: TabStatus; label: string }[] = [
  { id: 'OVERDUE', label: 'En retard' },
  { id: 'DUE_SOON', label: 'Dues cette semaine' },
  { id: 'UPCOMING', label: 'Dues ce mois' },
];

const AGE_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: 'Tout' },
  { label: '0-12 mois', min: 0, max: 12 },
  { label: '12-36 mois', min: 12, max: 36 },
  { label: '3-5 ans', min: 36, max: 60 },
];

function formatAge(birthDateIso: string): string {
  const birth = new Date(birthDateIso);
  const now = new Date();
  const diffMs = now.getTime() - birth.getTime();
  const totalMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
  if (totalMonths < 24) {
    return `${totalMonths} mois`;
  }
  const years = Math.floor(totalMonths / 12);
  const remainingMonths = totalMonths % 12;
  if (remainingMonths === 0) return `${years} ans`;
  return `${years} ans ${remainingMonths} mois`;
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('fr-MA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function DaysOverduePill({ days }: { days: number }) {
  if (days > 0) {
    return (
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 999,
          background: 'var(--danger-soft, #fef2f2)',
          color: 'var(--danger)',
        }}
      >
        +{days} j
      </span>
    );
  }
  if (days === 0) {
    return (
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 999,
          background: 'var(--amber-soft, #fffbeb)',
          color: 'var(--amber, #d97706)',
        }}
      >
        Aujourd&apos;hui
      </span>
    );
  }
  return (
    <span style={{ fontSize: 12, color: 'var(--ink-3)', padding: '2px 8px' }}>
      {Math.abs(days)} j
    </span>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: 7 }).map((__, j) => (
            <td key={j} style={{ padding: '10px 12px' }}>
              <div
                style={{
                  height: 14,
                  borderRadius: 4,
                  background: 'var(--border)',
                  width: j === 0 ? 32 : j === 1 ? '80%' : '60%',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function queueEntryToCalendarEntry(e: VaccinationQueueEntry): VaccinationCalendarEntry {
  return {
    id: null,
    scheduleDoseId: e.scheduleDoseId,
    vaccineId: e.vaccineId,
    vaccineCode: e.vaccineCode,
    vaccineName: e.vaccineName,
    doseNumber: e.doseNumber,
    doseLabel: e.doseLabel,
    targetDate: e.targetDate,
    toleranceDays: 30,
    status: e.status,
    administeredAt: null,
    lotNumber: null,
    route: null,
    site: null,
    administeredByName: null,
    deferralReason: null,
    notes: null,
    version: null,
  };
}

export default function VaccinationsQueuePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── URL-synced state ──────────────────────────────────────────────────────
  const statusParam = (searchParams.get('status') as TabStatus | null) ?? 'OVERDUE';
  const pageParam = parseInt(searchParams.get('page') ?? '0', 10);
  const vaccineCodeParam = searchParams.get('vaccineCode') ?? '';

  const setStatus = useCallback(
    (s: TabStatus) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('status', s);
        next.set('page', '0');
        return next;
      });
    },
    [setSearchParams],
  );

  const setPage = useCallback(
    (p: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('page', String(p));
        return next;
      });
    },
    [setSearchParams],
  );

  const setVaccineCode = useCallback(
    (code: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (code) next.set('vaccineCode', code); else next.delete('vaccineCode');
        next.set('page', '0');
        return next;
      });
    },
    [setSearchParams],
  );

  // ── Local filter state (age presets) ─────────────────────────────────────
  const [agePreset, setAgePreset] = useState(0); // index into AGE_PRESETS

  const preset = AGE_PRESETS[agePreset];

  const filters: VaccinationsQueueFilters = {
    status: statusParam,
    page: pageParam,
    size: 50,
    ...(vaccineCodeParam ? { vaccineCode: vaccineCodeParam } : {}),
    ...(preset?.min !== undefined ? { ageGroupMinMonths: preset.min } : {}),
    ...(preset?.max !== undefined ? { ageGroupMaxMonths: preset.max } : {}),
    ...(statusParam === 'UPCOMING' ? { upcomingHorizonDays: 30 } : {}),
  };

  const { entries, totalElements, totalPages, currentPage, isLoading, error } =
    useVaccinationsQueue(filters);
  const { catalog } = useVaccinationCatalog();

  // ── Drawer state ──────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPatientId, setDrawerPatientId] = useState<string>('');
  const [drawerDose, setDrawerDose] = useState<VaccinationCalendarEntry | null>(null);

  function handleRecord(entry: VaccinationQueueEntry) {
    setDrawerPatientId(entry.patientId);
    setDrawerDose(queueEntryToCalendarEntry(entry));
    setDrawerOpen(true);
  }

  function handleDrawerClose() {
    setDrawerOpen(false);
    setDrawerDose(null);
    setDrawerPatientId('');
  }

  const overdueTabCount = statusParam === 'OVERDUE' ? totalElements : undefined;

  return (
    <Screen
      active="vaccinations"
      title="Vaccinations"
      sub="Suivi PNI marocain — patients pédiatriques"
      onNavigate={(id) => {
        const path = NAV_MAP[id as keyof typeof NAV_MAP];
        if (path) navigate(path);
      }}
      topbarRight={undefined}
    >
      <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 6,
          }}
          role="tablist"
          aria-label="Statut de vaccination"
        >
          {TABS.map((t) => {
            const isActive = statusParam === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setStatus(t.id)}
                style={{
                  padding: '6px 14px',
                  border: '1px solid var(--border)',
                  borderRadius: 999,
                  background: isActive ? 'var(--primary)' : 'var(--surface)',
                  color: isActive ? 'white' : 'var(--ink-2)',
                  fontFamily: 'inherit',
                  fontSize: 12.5,
                  fontWeight: 550,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {t.label}
                {t.id === 'OVERDUE' && overdueTabCount !== undefined && overdueTabCount > 0 && (
                  <span
                    style={{
                      minWidth: 18,
                      height: 18,
                      padding: '0 4px',
                      background: isActive ? 'rgba(255,255,255,0.3)' : 'var(--danger)',
                      color: 'white',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {overdueTabCount > 99 ? '99+' : overdueTabCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Filters toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label
              htmlFor="vq-vaccine"
              style={{ fontSize: 11.5, color: 'var(--ink-3)', marginRight: 6 }}
            >
              Vaccin
            </label>
            <select
              id="vq-vaccine"
              value={vaccineCodeParam}
              onChange={(e) => setVaccineCode(e.target.value)}
              style={{
                height: 32,
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                padding: '0 8px',
                fontSize: 12.5,
                fontFamily: 'inherit',
                background: 'var(--surface)',
                color: 'var(--ink)',
              }}
            >
              <option value="">Tous les vaccins</option>
              {catalog.map((v) => (
                <option key={v.code} value={v.code}>
                  {v.nameFr} ({v.code})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Tranche d&apos;âge</span>
            {AGE_PRESETS.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setAgePreset(i)}
                style={{
                  padding: '4px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: 999,
                  background: agePreset === i ? 'var(--primary-soft)' : 'var(--surface)',
                  color: agePreset === i ? 'var(--primary)' : 'var(--ink-2)',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: agePreset === i ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <span
            style={{
              marginLeft: 'auto',
              fontSize: 12,
              color: 'var(--ink-3)',
            }}
          >
            {!isLoading && `${totalElements} résultat${totalElements !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Error state */}
        {error && (
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--danger-soft, #fef2f2)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--r-md)',
              fontSize: 13,
              color: 'var(--danger)',
            }}
          >
            {error}
          </div>
        )}

        {/* Table */}
        <Panel style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
              role="table"
              aria-label={`Vaccinations ${TABS.find((t) => t.id === statusParam)?.label ?? ''}`}
            >
              <thead>
                <tr
                  style={{
                    background: 'var(--surface-2)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <th
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'var(--ink-3)',
                    }}
                  >
                    Patient
                  </th>
                  <th
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'var(--ink-3)',
                    }}
                  >
                    Nom
                  </th>
                  <th
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'var(--ink-3)',
                    }}
                  >
                    Age
                  </th>
                  <th
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'var(--ink-3)',
                    }}
                  >
                    Vaccin
                  </th>
                  <th
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'var(--ink-3)',
                    }}
                  >
                    Dose
                  </th>
                  <th
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'var(--ink-3)',
                    }}
                  >
                    Date prévue
                  </th>
                  <th
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'var(--ink-3)',
                    }}
                  >
                    Retard
                  </th>
                  <th scope="col" style={{ padding: '10px 12px' }}>
                    <span style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
                      Actions
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <SkeletonRows />}
                {!isLoading && entries.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        padding: '40px 16px',
                        textAlign: 'center',
                        color: 'var(--ink-3)',
                        fontSize: 13,
                      }}
                    >
                      {statusParam === 'OVERDUE'
                        ? 'Aucune dose en retard'
                        : statusParam === 'DUE_SOON'
                        ? 'Aucune dose due cette semaine'
                        : 'Aucune dose due ce mois'}
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  entries.map((entry, idx) => {
                    const initials =
                      `${entry.patientFirstName[0] ?? ''}${entry.patientLastName[0] ?? ''}`.toUpperCase();
                    return (
                      <tr
                        key={`${entry.patientId}-${entry.vaccineCode}-${entry.doseNumber}-${idx}`}
                        style={{
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        <td style={{ padding: '10px 12px' }}>
                          <Avatar initials={initials} size="sm" />
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <a
                            href={`/patients/${entry.patientId}`}
                            style={{
                              color: 'var(--primary)',
                              textDecoration: 'none',
                              fontWeight: 550,
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              navigate(`/patients/${entry.patientId}`);
                            }}
                          >
                            {entry.patientLastName} {entry.patientFirstName}
                          </a>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--ink-2)' }}>
                          {formatAge(entry.patientBirthDate)}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 550 }}>
                          {entry.vaccineName}
                          <span
                            style={{
                              marginLeft: 4,
                              fontSize: 11,
                              color: 'var(--ink-3)',
                              fontWeight: 400,
                            }}
                          >
                            ({entry.vaccineCode})
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--ink-2)' }}>
                          {entry.doseLabel}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--ink-2)' }}>
                          {formatDate(entry.targetDate)}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <DaysOverduePill days={entry.daysOverdue} />
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleRecord(entry)}
                          >
                            Saisir dose
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <Button
              size="sm"
              variant="ghost"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Page précédente"
            >
              <ChevronLeft />
              Précédent
            </Button>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              Page {currentPage + 1} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage(currentPage + 1)}
              aria-label="Page suivante"
            >
              Suivant
              <ChevronRight />
            </Button>
          </div>
        )}
      </div>

      {/* Dose drawer — slide-over panel */}
      {drawerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 30,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleDrawerClose();
          }}
        >
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: 440,
            }}
          >
            <RecordDoseDrawer
              patientId={drawerPatientId}
              dose={drawerDose}
              mode="record"
              onClose={handleDrawerClose}
            />
          </div>
        </div>
      )}
    </Screen>
  );
}
