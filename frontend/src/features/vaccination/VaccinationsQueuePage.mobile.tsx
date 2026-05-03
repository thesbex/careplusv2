/**
 * /vaccinations — Worklist transversale (mobile 390 px).
 * Same data as the desktop page, presented as stacked cards.
 * "Charger plus" pagination instead of prev/next buttons.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar } from '@/components/shell/MTopbar';
import { Avatar } from '@/components/ui/Avatar';
import {
  useVaccinationsQueue,
  type VaccinationQueueEntry,
  type VaccinationsQueueFilters,
} from './hooks/useVaccinationsQueue';
import { RecordDoseDrawerMobile } from './components/RecordDoseDrawer.mobile';
import type { VaccinationCalendarEntry } from './types';

type TabStatus = 'OVERDUE' | 'DUE_SOON' | 'UPCOMING';

const TABS: { id: TabStatus; label: string }[] = [
  { id: 'OVERDUE', label: 'En retard' },
  { id: 'DUE_SOON', label: 'Cette semaine' },
  { id: 'UPCOMING', label: 'Ce mois' },
];

function formatAge(birthDateIso: string): string {
  const birth = new Date(birthDateIso);
  const now = new Date();
  const diffMs = now.getTime() - birth.getTime();
  const totalMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
  if (totalMonths < 24) return `${totalMonths} mois`;
  const years = Math.floor(totalMonths / 12);
  const rem = totalMonths % 12;
  if (rem === 0) return `${years} ans`;
  return `${years} ans ${rem} mois`;
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('fr-MA', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

function DaysOverdueBadge({ days }: { days: number }) {
  if (days > 0) {
    return (
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          padding: '2px 7px',
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
          fontSize: 11,
          fontWeight: 600,
          padding: '2px 7px',
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
    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
      {Math.abs(days)} j
    </span>
  );
}

function VaccineCard({
  entry,
  onRecord,
}: {
  entry: VaccinationQueueEntry;
  onRecord: (entry: VaccinationQueueEntry) => void;
}) {
  const navigate = useNavigate();
  const initials =
    `${entry.patientFirstName[0] ?? ''}${entry.patientLastName[0] ?? ''}`.toUpperCase();

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Top row: avatar + name + age */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar initials={initials} size="md" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <button
            type="button"
            onClick={() => navigate(`/patients/${entry.patientId}`)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              fontFamily: 'inherit',
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--primary)',
              cursor: 'pointer',
              display: 'block',
              textAlign: 'left',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.patientLastName} {entry.patientFirstName}
          </button>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>
            {formatAge(entry.patientBirthDate)}
          </div>
        </div>
      </div>

      {/* Middle row: vaccine + dose */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
          {entry.vaccineName}
        </span>
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>({entry.vaccineCode})</span>
        <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{entry.doseLabel}</span>
      </div>

      {/* Bottom row: date + overdue + action */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          {formatDate(entry.targetDate)}
        </span>
        <DaysOverdueBadge days={entry.daysOverdue} />
        <button
          type="button"
          onClick={() => onRecord(entry)}
          style={{
            marginLeft: 'auto',
            height: 36,
            padding: '0 16px',
            background: 'var(--primary)',
            color: 'var(--primary-ink, white)',
            border: 'none',
            borderRadius: 'var(--r-lg)',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          Saisir
        </button>
      </div>
    </div>
  );
}

function SkeletonCards() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--border)',
              }}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{ height: 14, width: '60%', background: 'var(--border)', borderRadius: 4 }}
              />
              <div
                style={{ height: 11, width: '30%', background: 'var(--border)', borderRadius: 4 }}
              />
            </div>
          </div>
          <div style={{ height: 13, width: '80%', background: 'var(--border)', borderRadius: 4 }} />
          <div
            style={{
              height: 36,
              width: '40%',
              background: 'var(--border)',
              borderRadius: 'var(--r-lg)',
              alignSelf: 'flex-end',
            }}
          />
        </div>
      ))}
    </>
  );
}

export default function VaccinationsQueuePageMobile() {
  const [activeTab, setActiveTab] = useState<TabStatus>('OVERDUE');
  const [page, setPage] = useState(0);

  const filters: VaccinationsQueueFilters = {
    status: activeTab,
    page: 0,
    size: (page + 1) * 20, // "load more" accumulation
    ...(activeTab === 'UPCOMING' ? { upcomingHorizonDays: 30 } : {}),
  };

  const { entries, totalElements, isLoading, error } = useVaccinationsQueue(filters);

  // ── Drawer state ──────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPatientId, setDrawerPatientId] = useState('');
  const [drawerDose, setDrawerDose] = useState<VaccinationCalendarEntry | null>(null);

  function handleRecord(entry: VaccinationQueueEntry) {
    setDrawerPatientId(entry.patientId);
    setDrawerDose(queueEntryToCalendarEntry(entry));
    setDrawerOpen(true);
  }

  function handleTabChange(tab: TabStatus) {
    setActiveTab(tab);
    setPage(0);
  }

  const hasMore = entries.length < totalElements;

  return (
    <MScreen
      tab="salle"
      topbar={
        <MTopbar title="Vaccinations" sub="Suivi PNI marocain" />
      }
    >
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Statut de vaccination"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          gap: 0,
          overflowX: 'auto',
        }}
      >
        {TABS.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabChange(t.id)}
              style={{
                flex: '1 0 auto',
                padding: '12px 14px',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                background: 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--ink-3)',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {error && (
          <div
            style={{
              padding: '12px 14px',
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

        {isLoading && entries.length === 0 && <SkeletonCards />}

        {!isLoading && entries.length === 0 && !error && (
          <div
            style={{
              padding: '40px 0',
              textAlign: 'center',
              color: 'var(--ink-3)',
              fontSize: 14,
            }}
          >
            {activeTab === 'OVERDUE'
              ? 'Aucune dose en retard'
              : activeTab === 'DUE_SOON'
              ? 'Aucune dose due cette semaine'
              : 'Aucune dose due ce mois'}
          </div>
        )}

        {entries.map((entry, idx) => (
          <VaccineCard
            key={`${entry.patientId}-${entry.vaccineCode}-${entry.doseNumber}-${idx}`}
            entry={entry}
            onRecord={handleRecord}
          />
        ))}

        {/* Load more */}
        {hasMore && !isLoading && (
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            style={{
              width: '100%',
              height: 44,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              fontFamily: 'inherit',
              fontSize: 14,
              color: 'var(--ink-2)',
              cursor: 'pointer',
              marginTop: 4,
            }}
          >
            Charger plus ({totalElements - entries.length} restants)
          </button>
        )}

        {isLoading && entries.length > 0 && (
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-3)', padding: 12 }}>
            Chargement…
          </div>
        )}
      </div>

      {/* Dose drawer */}
      <RecordDoseDrawerMobile
        patientId={drawerPatientId}
        dose={drawerDose}
        mode="record"
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </MScreen>
  );
}
