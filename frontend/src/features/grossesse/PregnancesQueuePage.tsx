/**
 * /grossesses — Worklist transversale (desktop).
 * Liste paginée des grossesses EN_COURS avec filtres trimestre / alertes /
 * recherche par nom de patiente. Route guarded :
 * SECRETAIRE / ASSISTANT / MEDECIN / ADMIN.
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Avatar } from '@/components/ui/Avatar';
import { ChevronLeft, ChevronRight, Warn } from '@/components/icons';
import { useT } from '@/lib/i18n/I18nProvider';
import {
  usePregnancyQueue,
  type PregnancyQueueEntry,
  type PregnancyQueueFilters,
} from './hooks/usePregnancyQueue';
import type { Trimester } from './types';

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

const TRIMESTER_IDS: (Trimester | 'ALL')[] = ['ALL', 'T1', 'T2', 'T3'];

const PAGE_SIZE = 20;

type Tr = (key: string, vars?: Record<string, string | number>) => string;

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

function relativeFromNow(iso: string | null, t: Tr): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return t('gross.rel.today');
  if (days === 1) return t('gross.rel.yesterday');
  if (days < 30) return t('gross.rel.daysAgo', { n: days });
  const months = Math.floor(days / 30);
  if (months < 12) return t('gross.rel.monthsAgo', { n: months });
  const years = Math.floor(months / 12);
  return t('gross.rel.yearsAgo', { n: years, s: years > 1 ? 's' : '' });
}

function TrimesterPill({ trimester }: { trimester: Trimester }) {
  const colors: Record<Trimester, { bg: string; fg: string }> = {
    T1: { bg: 'var(--info-soft, #eff6ff)', fg: 'var(--info, #2563eb)' },
    T2: { bg: 'var(--primary-soft)', fg: 'var(--primary)' },
    T3: { bg: 'var(--amber-soft, #fffbeb)', fg: 'var(--amber, #d97706)' },
  };
  const c = colors[trimester];
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 7px',
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
      }}
    >
      {trimester}
    </span>
  );
}

function AlertBadges({ entry }: { entry: PregnancyQueueEntry }) {
  if (entry.alerts.length === 0) return <span style={{ color: 'var(--ink-3)' }}>—</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {entry.alerts.map((a) => {
        const bg =
          a.severity === 'CRITICAL'
            ? 'var(--danger-soft, #fef2f2)'
            : a.severity === 'WARNING'
            ? 'var(--amber-soft, #fffbeb)'
            : 'var(--info-soft, #eff6ff)';
        const fg =
          a.severity === 'CRITICAL'
            ? 'var(--danger)'
            : a.severity === 'WARNING'
            ? 'var(--amber, #d97706)'
            : 'var(--info, #2563eb)';
        return (
          <span
            key={a.code}
            title={a.label}
            data-testid={`pq-alert-${a.code}`}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 999,
              background: bg,
              color: fg,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              maxWidth: 180,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <Warn style={{ width: 11, height: 11 }} />
            {a.label}
          </span>
        );
      })}
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: 7 }).map((__, j) => (
            <td key={j} style={{ padding: '10px 12px' }}>
              <div
                style={{
                  height: 14,
                  borderRadius: 4,
                  background: 'var(--border)',
                  width: j === 0 ? 32 : j === 1 ? '70%' : '50%',
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

export default function PregnancesQueuePage() {
  const navigate = useNavigate();
  const { t } = useT();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── URL-synced state ──────────────────────────────────────────────────────
  const trimesterParam = searchParams.get('trimester') as Trimester | null;
  const withAlertsParam = searchParams.get('withAlerts') === 'true';
  const qParam = searchParams.get('q') ?? '';
  const pageParam = parseInt(searchParams.get('page') ?? '0', 10);

  // Local debounced search (200 ms) — kept separate so typing doesn't refetch
  // on every keystroke.
  const [qInput, setQInput] = useState(qParam);
  useEffect(() => {
    const t = setTimeout(() => {
      if (qInput !== qParam) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          if (qInput.trim()) next.set('q', qInput.trim());
          else next.delete('q');
          next.set('page', '0');
          return next;
        });
      }
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  const setTrimester = useCallback(
    (t: Trimester | 'ALL') => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (t === 'ALL') next.delete('trimester');
        else next.set('trimester', t);
        next.set('page', '0');
        return next;
      });
    },
    [setSearchParams],
  );

  const setWithAlerts = useCallback(
    (v: boolean) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (v) next.set('withAlerts', 'true');
        else next.delete('withAlerts');
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

  const resetFilters = useCallback(() => {
    setQInput('');
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  const filters: PregnancyQueueFilters = {
    ...(trimesterParam ? { trimester: trimesterParam } : {}),
    ...(withAlertsParam ? { withAlerts: true } : {}),
    ...(qParam ? { q: qParam } : {}),
  };

  const filtersActive = !!trimesterParam || withAlertsParam || qParam.length > 0;

  const { entries, totalElements, totalPages, currentPage, isLoading, error } =
    usePregnancyQueue(filters, pageParam, PAGE_SIZE);

  return (
    <Screen
      active="grossesses"
      title={t('gross.queue.title')}
      sub={t('gross.queue.sub')}
      onNavigate={(id) => {
        const path = NAV_MAP[id as keyof typeof NAV_MAP];
        if (path) navigate(path);
      }}
      topbarRight={undefined}
    >
      <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Trimester chips */}
        <div
          style={{ display: 'flex', gap: 6 }}
          role="tablist"
          aria-label={t('gross.queue.filterByTrimester')}
        >
          {TRIMESTER_IDS.map((id) => {
            const isActive =
              id === 'ALL' ? !trimesterParam : trimesterParam === id;
            const label = id === 'ALL' ? t('gross.queue.trimester.all') : id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setTrimester(id)}
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
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Toolbar : search + with-alerts checkbox + reset */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder={t('gross.queue.searchPlaceholder')}
            aria-label={t('gross.queue.searchAria')}
            style={{
              height: 32,
              minWidth: 240,
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              padding: '0 10px',
              fontSize: 13,
              fontFamily: 'inherit',
              background: 'var(--surface)',
              color: 'var(--ink)',
            }}
          />

          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12.5,
              color: 'var(--ink-2)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={withAlertsParam}
              onChange={(e) => setWithAlerts(e.target.checked)}
              aria-label={t('gross.queue.withAlertsOnly')}
            />
            {t('gross.queue.withAlertsOnly')}
          </label>

          {filtersActive && (
            <Button
              size="sm"
              variant="ghost"
              onClick={resetFilters}
              aria-label={t('gross.queue.resetAria')}
            >
              {t('gross.queue.reset')}
            </Button>
          )}

          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)' }}>
            {!isLoading &&
              t('gross.queue.count', {
                n: totalElements,
                s: totalElements !== 1 ? 's' : '',
              })}
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
              aria-label={t('gross.queue.tableAria')}
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
                    colSpan={2}
                  >
                    {t('gross.queue.col.patient')}
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
                    {t('gross.queue.col.sa')}
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
                    {t('gross.queue.col.dpa')}
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
                    {t('gross.queue.col.lastVisit')}
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
                    {t('gross.queue.col.alerts')}
                  </th>
                  <th scope="col" style={{ padding: '10px 12px' }}>
                    <span
                      style={{
                        position: 'absolute',
                        width: 1,
                        height: 1,
                        padding: 0,
                        margin: -1,
                        overflow: 'hidden',
                        clip: 'rect(0,0,0,0)',
                        whiteSpace: 'nowrap',
                        border: 0,
                      }}
                    >
                      {t('gross.queue.col.actions')}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <SkeletonRows />}
                {!isLoading && entries.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: '40px 16px',
                        textAlign: 'center',
                        color: 'var(--ink-3)',
                        fontSize: 13,
                      }}
                    >
                      {t('gross.queue.empty')}{' '}
                      <a
                        href="/patients"
                        style={{ color: 'var(--primary)', fontWeight: 550 }}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate('/patients');
                        }}
                      >
                        {t('gross.queue.emptyCtaDesktop')}
                      </a>
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  entries.map((entry) => {
                    const initials =
                      `${entry.patientFirstName[0] ?? ''}${entry.patientLastName[0] ?? ''}`.toUpperCase();
                    return (
                      <tr
                        key={entry.pregnancyId}
                        data-testid={`pq-row-${entry.pregnancyId}`}
                        style={{ borderBottom: '1px solid var(--border)' }}
                      >
                        <td style={{ padding: '10px 12px', width: 44 }}>
                          <Avatar initials={initials} size="sm" />
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <a
                            href={`/patients/${entry.patientId}?tab=grossesse`}
                            style={{
                              color: 'var(--primary)',
                              textDecoration: 'none',
                              fontWeight: 550,
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              navigate(`/patients/${entry.patientId}?tab=grossesse`);
                            }}
                          >
                            {entry.patientLastName} {entry.patientFirstName}
                          </a>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--ink-2)' }}>
                          <span
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          >
                            <strong style={{ color: 'var(--ink)' }}>
                              {entry.saWeeks}
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 400,
                                  color: 'var(--ink-3)',
                                }}
                              >
                                +{entry.saDays}j
                              </span>
                            </strong>
                            <TrimesterPill trimester={entry.trimester} />
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--ink-2)' }}>
                          {formatDate(entry.dueDate)}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--ink-2)' }}>
                          {relativeFromNow(entry.lastVisitAt, t)}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <AlertBadges entry={entry} />
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() =>
                              navigate(`/patients/${entry.patientId}?tab=grossesse`)
                            }
                          >
                            {t('gross.queue.view')}
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
              aria-label={t('gross.queue.prevAria')}
            >
              <ChevronLeft />
              {t('gross.queue.prev')}
            </Button>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {t('gross.queue.pageOf', { current: currentPage + 1, total: totalPages })}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage(currentPage + 1)}
              aria-label={t('gross.queue.nextAria')}
            >
              {t('gross.queue.next')}
              <ChevronRight />
            </Button>
          </div>
        )}
      </div>
    </Screen>
  );
}
