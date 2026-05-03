/**
 * /grossesses — Worklist transversale (mobile 390 px).
 * Cards empilées par patiente. Filtres dans une bottom-sheet déclenchée
 * via "Filtres" ; "Charger plus" pour la pagination.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar } from '@/components/shell/MTopbar';
import { Avatar } from '@/components/ui/Avatar';
import { Filter, Warn, Close } from '@/components/icons';
import {
  usePregnancyQueue,
  type PregnancyQueueEntry,
  type PregnancyQueueFilters,
} from './hooks/usePregnancyQueue';
import type { Trimester } from './types';

const TRIMESTERS: { id: Trimester | 'ALL'; label: string }[] = [
  { id: 'ALL', label: 'Toutes' },
  { id: 'T1', label: 'T1' },
  { id: 'T2', label: 'T2' },
  { id: 'T3', label: 'T3' },
];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-MA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function relativeFromNow(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  if (days < 30) return `il y a ${days} j`;
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  const years = Math.floor(months / 12);
  return `il y a ${years} an${years > 1 ? 's' : ''}`;
}

function PregnancyCard({
  entry,
  onOpen,
}: {
  entry: PregnancyQueueEntry;
  onOpen: (e: PregnancyQueueEntry) => void;
}) {
  const initials =
    `${entry.patientFirstName[0] ?? ''}${entry.patientLastName[0] ?? ''}`.toUpperCase();
  return (
    <div
      data-testid={`pq-card-${entry.pregnancyId}`}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => onOpen(entry)}
        style={{
          width: '100%',
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar initials={initials} size="md" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.patientLastName} {entry.patientFirstName}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
              SA {entry.saWeeks}+{entry.saDays}j · DPA {formatDate(entry.dueDate)} ·{' '}
              <span style={{ fontWeight: 600 }}>{entry.trimester}</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
              Dernière visite : {relativeFromNow(entry.lastVisitAt)}
            </div>
          </div>
        </div>
      </button>

      {entry.alerts.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            padding: '8px 16px 12px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-2, transparent)',
          }}
        >
          {entry.alerts.map((a) => (
            <span
              key={a.code}
              data-testid={`pq-alert-${a.code}`}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: 999,
                background:
                  a.severity === 'CRITICAL'
                    ? 'var(--danger-soft, #fef2f2)'
                    : a.severity === 'WARNING'
                    ? 'var(--amber-soft, #fffbeb)'
                    : 'var(--info-soft, #eff6ff)',
                color:
                  a.severity === 'CRITICAL'
                    ? 'var(--danger)'
                    : a.severity === 'WARNING'
                    ? 'var(--amber, #d97706)'
                    : 'var(--info, #2563eb)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Warn style={{ width: 11, height: 11 }} />
              {a.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  trimester: Trimester | null;
  onTrimesterChange: (t: Trimester | null) => void;
  withAlerts: boolean;
  onWithAlertsChange: (v: boolean) => void;
  q: string;
  onQChange: (v: string) => void;
  onReset: () => void;
}

function FilterSheet({
  open,
  onClose,
  trimester,
  onTrimesterChange,
  withAlerts,
  onWithAlertsChange,
  q,
  onQChange,
  onReset,
}: FilterSheetProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-label="Filtres"
      data-testid="pq-filter-sheet"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'flex-end',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          width: '100%',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: '14px 16px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: 14, flex: 1 }}>Filtres</strong>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              color: 'var(--ink-3)',
            }}
          >
            <Close />
          </button>
        </div>

        <div>
          <label
            htmlFor="pq-mob-q"
            style={{
              fontSize: 11.5,
              color: 'var(--ink-3)',
              fontWeight: 600,
              display: 'block',
              marginBottom: 4,
            }}
          >
            Recherche
          </label>
          <input
            id="pq-mob-q"
            type="search"
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            placeholder="Nom de patiente…"
            style={{
              width: '100%',
              height: 40,
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              padding: '0 10px',
              fontSize: 14,
              fontFamily: 'inherit',
              background: 'var(--surface)',
              color: 'var(--ink)',
            }}
          />
        </div>

        <div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 6 }}>
            Trimestre
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TRIMESTERS.map((t) => {
              const active = t.id === 'ALL' ? trimester == null : trimester === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTrimesterChange(t.id === 'ALL' ? null : t.id)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 999,
                    background: active ? 'var(--primary)' : 'var(--surface)',
                    color: active ? 'white' : 'var(--ink-2)',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: 550,
                    cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13.5,
            color: 'var(--ink-2)',
          }}
        >
          <input
            type="checkbox"
            checked={withAlerts}
            onChange={(e) => onWithAlertsChange(e.target.checked)}
          />
          Avec alertes uniquement
        </label>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={onReset}
            style={{
              flex: 1,
              height: 44,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              fontFamily: 'inherit',
              fontSize: 14,
              color: 'var(--ink-2)',
              cursor: 'pointer',
            }}
          >
            Réinitialiser
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              height: 44,
              background: 'var(--primary)',
              border: 'none',
              borderRadius: 'var(--r-lg)',
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 600,
              color: 'white',
              cursor: 'pointer',
            }}
          >
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PregnancesQueuePageMobile() {
  const navigate = useNavigate();
  const [trimester, setTrimester] = useState<Trimester | null>(null);
  const [withAlerts, setWithAlerts] = useState(false);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);

  const filters: PregnancyQueueFilters = {
    ...(trimester ? { trimester } : {}),
    ...(withAlerts ? { withAlerts: true } : {}),
    ...(q.trim() ? { q: q.trim() } : {}),
  };

  // "Load more" pagination — accumulate by inflating size.
  const { entries, totalElements, isLoading, error } = usePregnancyQueue(
    filters,
    0,
    (page + 1) * 20,
  );

  const filtersActive = trimester != null || withAlerts || q.trim().length > 0;
  const hasMore = entries.length < totalElements;

  function resetAll() {
    setTrimester(null);
    setWithAlerts(false);
    setQ('');
    setPage(0);
  }

  return (
    <MScreen
      tab="patients"
      topbar={
        <MTopbar
          title="Grossesses"
          sub="Suivi PSGA"
          right={
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              aria-label="Filtres"
              style={{
                background: 'transparent',
                border: 'none',
                padding: 6,
                cursor: 'pointer',
                color: filtersActive ? 'var(--primary)' : 'var(--ink-2)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            >
              <Filter />
              {filtersActive ? 'Filtres ●' : 'Filtres'}
            </button>
          }
        />
      }
    >
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

        {isLoading && entries.length === 0 && (
          <div
            style={{ textAlign: 'center', padding: 24, fontSize: 13, color: 'var(--ink-3)' }}
          >
            Chargement…
          </div>
        )}

        {!isLoading && entries.length === 0 && !error && (
          <div
            style={{
              padding: '40px 16px',
              textAlign: 'center',
              color: 'var(--ink-3)',
              fontSize: 14,
            }}
          >
            Aucune grossesse en cours.
          </div>
        )}

        {entries.map((entry) => (
          <PregnancyCard
            key={entry.pregnancyId}
            entry={entry}
            onOpen={(e) => navigate(`/patients/${e.patientId}?tab=grossesse`)}
          />
        ))}

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

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        trimester={trimester}
        onTrimesterChange={(t) => {
          setTrimester(t);
          setPage(0);
        }}
        withAlerts={withAlerts}
        onWithAlertsChange={(v) => {
          setWithAlerts(v);
          setPage(0);
        }}
        q={q}
        onQChange={(v) => {
          setQ(v);
          setPage(0);
        }}
        onReset={resetAll}
      />
    </MScreen>
  );
}
