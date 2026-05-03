/**
 * Screen 09 — Facturation (mobile).
 * Compact list view with status filter chips + advanced filters popover.
 * Export button is hidden on mobile (cf. design Q10) — comptable use case
 * lives on desktop.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { ChevronRight } from '@/components/icons';
import { useInvoice } from './hooks/useInvoices';
import { useInvoiceSearch } from './hooks/useInvoiceSearch';
import { InvoiceDrawer } from './InvoiceDrawer';
import { CaisseTodayPanel } from '../caisse/CaisseTodayPanel';
import { AdvancedFiltersPopover } from './AdvancedFiltersPopover';
import {
  STATUS_LABEL,
  type InvoiceSearchFilters,
  type InvoiceStatus,
} from './types';
import './facturation.css';

const TAB_MAP: Record<MobileTab, string> = {
  agenda:   '/agenda',
  salle:    '/salle',
  patients: '/patients',
  factu:    '/facturation',
  menu:     '/parametres',
};

const FILTERS: { key: InvoiceStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Toutes' },
  { key: 'BROUILLON', label: 'Brouillons' },
  { key: 'EMISE', label: 'Émises' },
  { key: 'PAYEE_PARTIELLE', label: 'Partielles' },
  { key: 'PAYEE_TOTALE', label: 'Payées' },
];

const STATUS_PILL: Record<InvoiceStatus, string> = {
  BROUILLON: 'waiting',
  EMISE: 'arrived',
  PAYEE_PARTIELLE: 'vitals',
  PAYEE_TOTALE: 'done',
  ANNULEE: 'done',
};

function formatMad(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} MAD`;
}

function filtersFromUrl(params: URLSearchParams): InvoiceSearchFilters {
  return {
    dateField: (params.get('dateField') as InvoiceSearchFilters['dateField']) ?? 'ISSUED',
    from: params.get('from'),
    to: params.get('to'),
    statuses: params.getAll('status') as InvoiceStatus[],
    paymentModes: params.getAll('paymentMode') as InvoiceSearchFilters['paymentModes'],
    patientId: params.get('patientId'),
    amountMin: params.get('amountMin') ? Number(params.get('amountMin')) : null,
    amountMax: params.get('amountMax') ? Number(params.get('amountMax')) : null,
  };
}

function filtersToUrl(f: InvoiceSearchFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.dateField !== 'ISSUED') p.set('dateField', f.dateField);
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  for (const s of f.statuses) p.append('status', s);
  for (const m of f.paymentModes) p.append('paymentMode', m);
  if (f.patientId) p.set('patientId', f.patientId);
  if (f.amountMin !== null) p.set('amountMin', String(f.amountMin));
  if (f.amountMax !== null) p.set('amountMax', String(f.amountMax));
  return p;
}

export default function FacturationMobilePage() {
  const navigate = useNavigate();
  const [urlParams, setUrlParams] = useSearchParams();
  const [filters, setFilters] = useState<InvoiceSearchFilters>(() => filtersFromUrl(urlParams));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setUrlParams(filtersToUrl(filters), { replace: true });
  }, [filters, setUrlParams]);

  const statusChip: InvoiceStatus | 'ALL' =
    filters.statuses.length === 1 ? (filters.statuses[0] ?? 'ALL') : 'ALL';
  function setStatusChip(s: InvoiceStatus | 'ALL') {
    setFilters({ ...filters, statuses: s === 'ALL' ? [] : [s] });
  }

  const { items, totalCount, totalPaid, totalRemaining, isLoading, error } =
    useInvoiceSearch(filters);
  const { invoice: selectedDetail } = useInvoice(selectedId ?? undefined);
  const selected = useMemo(() => selectedDetail ?? null, [selectedDetail]);

  return (
    <MScreen
      tab="factu"
      topbar={<MTopbar brand title="Facturation" />}
      onTabChange={(t) => navigate(TAB_MAP[t])}
    >
      <div className="mb-pad">
        <CaisseTodayPanel />
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 12 }}>
          {totalCount} facture{totalCount > 1 ? 's' : ''}
        </div>

        <div className="m-stat-grid">
          <div className="m-stat">
            <div className="m-stat-k">Encaissé</div>
            <div className="m-stat-v" style={{ color: 'var(--success)' }}>
              {formatMad(totalPaid)}
            </div>
          </div>
          <div className="m-stat">
            <div className="m-stat-k">À encaisser</div>
            <div className="m-stat-v" style={{ color: 'var(--amber)' }}>
              {formatMad(totalRemaining)}
            </div>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Filtres statut"
          style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            paddingBottom: 8,
            marginBottom: 4,
            WebkitOverflowScrolling: 'touch',
            alignItems: 'center',
          }}
        >
          {FILTERS.map((f) => {
            const on = statusChip === f.key;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setStatusChip(f.key)}
                style={{
                  flexShrink: 0,
                  height: 32,
                  padding: '0 14px',
                  borderRadius: 'var(--r-lg)',
                  border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                  background: on ? 'var(--primary-soft)' : 'var(--surface)',
                  color: on ? 'var(--primary)' : 'var(--ink-2)',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {f.label}
              </button>
            );
          })}
          <div style={{ marginLeft: 'auto' }}>
            <AdvancedFiltersPopover filters={filters} onChange={setFilters} />
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>
            {error}
          </div>
        )}

        <div className="m-card">
          {isLoading ? (
            <div style={{ padding: 20, color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>
              Chargement…
            </div>
          ) : items.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                color: 'var(--ink-3)',
                fontSize: 13,
              }}
            >
              Aucune facture pour ces filtres.
            </div>
          ) : (
            items.map((inv, i) => {
              const date = inv.issuedAt ?? inv.createdAt;
              return (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => setSelectedId(inv.id)}
                  className="m-row"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 0,
                    borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)',
                    fontFamily: 'inherit',
                    font: 'inherit',
                    cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <div className="m-row-pri">
                    <div
                      className="m-row-main"
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>
                        {inv.number ?? `BR-${inv.id.slice(0, 8).toUpperCase()}`}
                      </span>
                      <span className={`m-pill ${STATUS_PILL[inv.status]}`}>
                        {STATUS_LABEL[inv.status]}
                      </span>
                    </div>
                    <div className="m-row-sub">
                      {inv.patientFullName || inv.patientId.slice(0, 8).toUpperCase()} ·{' '}
                      {new Date(date).toLocaleDateString('fr-MA', {
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="tnum" style={{ fontSize: 13, fontWeight: 600 }}>
                      {formatMad(inv.netAmount)}
                    </div>
                    {inv.paidAmount > 0 && (
                      <div
                        className="tnum"
                        style={{ fontSize: 11, color: 'var(--success)', marginTop: 2 }}
                      >
                        {formatMad(inv.paidAmount)} payé
                      </div>
                    )}
                  </div>
                  <ChevronRight aria-hidden="true" />
                </button>
              );
            })
          )}
        </div>
      </div>

      <InvoiceDrawer
        invoice={selected}
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) setSelectedId(null);
        }}
      />
    </MScreen>
  );
}
