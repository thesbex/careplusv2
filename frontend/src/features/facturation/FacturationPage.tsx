/**
 * Screen 09 — Facturation (desktop).
 * Liste des factures avec filtres avancés (dates, modes, patient, montants),
 * KPIs agrégés sur le résultat filtré, et export CSV / xlsx.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { useAuthStore } from '@/lib/auth/authStore';
import { useInvoice } from './hooks/useInvoices';
import { useInvoiceSearch } from './hooks/useInvoiceSearch';
import { InvoiceDrawer } from './InvoiceDrawer';
import { CaisseTodayPanel } from '../caisse/CaisseTodayPanel';
import { AdvancedFiltersPopover } from './AdvancedFiltersPopover';
import { ExportButton } from './ExportButton';
import {
  EMPTY_FILTERS,
  STATUS_LABEL,
  type InvoiceSearchFilters,
  type InvoiceStatus,
} from './types';
import './facturation.css';

const NAV_MAP = {
  agenda: '/agenda',
  patients: '/patients',
  salle: '/salle',
  consult: '/consultations',
  factu: '/facturation',
  vaccinations: '/vaccinations',
  stock: '/stock',
  catalogue: '/catalogue',
  params: '/parametres',
} as const;

const STATUS_FILTERS: { key: InvoiceStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Toutes' },
  { key: 'BROUILLON', label: 'Brouillons' },
  { key: 'EMISE', label: 'Émises' },
  { key: 'PAYEE_PARTIELLE', label: 'Partielles' },
  { key: 'PAYEE_TOTALE', label: 'Payées' },
  { key: 'ANNULEE', label: 'Annulées' },
];

const STATUS_CLASS: Record<InvoiceStatus, string> = {
  BROUILLON: 'brouillon',
  EMISE: 'emise',
  PAYEE_PARTIELLE: 'partielle',
  PAYEE_TOTALE: 'totale',
  ANNULEE: 'annulee',
};

function formatMad(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} MAD`;
}

// ── URL sync helpers ────────────────────────────────────────────────────────

function filtersFromUrl(params: URLSearchParams): InvoiceSearchFilters {
  const statuses = params.getAll('status') as InvoiceStatus[];
  const paymentModes = params.getAll('paymentMode') as InvoiceSearchFilters['paymentModes'];
  return {
    dateField: (params.get('dateField') as InvoiceSearchFilters['dateField']) ?? 'ISSUED',
    from: params.get('from'),
    to: params.get('to'),
    statuses,
    paymentModes,
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

export default function FacturationPage() {
  const navigate = useNavigate();
  const [urlParams, setUrlParams] = useSearchParams();
  const [filters, setFilters] = useState<InvoiceSearchFilters>(() => filtersFromUrl(urlParams));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Sync filter state → URL
  useEffect(() => {
    setUrlParams(filtersToUrl(filters), { replace: true });
  }, [filters, setUrlParams]);

  const statusChip: InvoiceStatus | 'ALL' =
    filters.statuses.length === 1 ? (filters.statuses[0] ?? 'ALL') : 'ALL';

  function setStatusChip(s: InvoiceStatus | 'ALL') {
    setFilters({ ...filters, statuses: s === 'ALL' ? [] : [s] });
  }

  const { items, totalCount, totalNet, totalPaid, totalRemaining, isLoading, error } =
    useInvoiceSearch(filters);

  // Drawer needs the full invoice (lines + payments). When user clicks a row
  // we fetch the detail; the legacy hook still works.
  const { invoice: selectedDetail } = useInvoice(selectedId ?? undefined);
  const selected = useMemo(() => selectedDetail ?? null, [selectedDetail]);

  const canExport = useAuthStore(
    (s) => s.user?.roles.includes('MEDECIN') || s.user?.roles.includes('ADMIN'),
  ) ?? false;

  return (
    <Screen
      active="factu"
      title="Facturation"
      sub={`${totalCount} facture${totalCount > 1 ? 's' : ''}`}
      onNavigate={(navId) => navigate(NAV_MAP[navId])}
    >
      <div className="fa-scroll scroll">
        <CaisseTodayPanel />

        <div className="fa-toolbar">
          <div className="fa-filters" role="tablist" aria-label="Filtres statut">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={statusChip === f.key}
                className={`fa-filter-btn${statusChip === f.key ? ' active' : ''}`}
                onClick={() => setStatusChip(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="fa-toolbar-end">
            <AdvancedFiltersPopover filters={filters} onChange={setFilters} />
            {canExport && <ExportButton filters={filters} />}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <Panel>
            <div style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase' }}>
                Total net
              </div>
              <div className="tnum" style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
                {formatMad(totalNet)}
              </div>
            </div>
          </Panel>
          <Panel>
            <div style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase' }}>
                Encaissé
              </div>
              <div
                className="tnum"
                style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: '#2E7D32' }}
              >
                {formatMad(totalPaid)}
              </div>
            </div>
          </Panel>
          <Panel>
            <div style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase' }}>
                À encaisser
              </div>
              <div
                className="tnum"
                style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: 'var(--amber)' }}
              >
                {formatMad(totalRemaining)}
              </div>
            </div>
          </Panel>
        </div>

        <Panel style={{ padding: 0 }}>
          <PanelHeader>
            <span>Liste des factures</span>
          </PanelHeader>

          {isLoading && (
            <div style={{ padding: 20, color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</div>
          )}
          {error && (
            <div style={{ padding: 20, color: 'var(--danger)', fontSize: 13 }}>{error}</div>
          )}

          {!isLoading && items.length === 0 && !error && (
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
          )}

          {items.length > 0 && (
            <table className="fa-table" style={{ borderRadius: 0, border: 'none' }}>
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Patient</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th style={{ textAlign: 'right' }}>Total net</th>
                  <th style={{ textAlign: 'right' }}>Encaissé</th>
                </tr>
              </thead>
              <tbody>
                {items.map((inv) => {
                  const date = inv.issuedAt ?? inv.createdAt;
                  return (
                    <tr key={inv.id} onClick={() => setSelectedId(inv.id)}>
                      <td>
                        <span className="mono" style={{ fontSize: 12 }}>
                          {inv.number ?? `BR-${inv.id.slice(0, 8).toUpperCase()}`}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12 }}>
                          {inv.patientFullName || inv.patientId.slice(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td className="tnum">
                        {new Date(date).toLocaleDateString('fr-MA')}
                      </td>
                      <td>
                        <span className={`fa-status-pill ${STATUS_CLASS[inv.status]}`}>
                          {STATUS_LABEL[inv.status]}
                        </span>
                      </td>
                      <td className="tnum" style={{ textAlign: 'right' }}>
                        {formatMad(inv.netAmount)}
                      </td>
                      <td className="tnum" style={{ textAlign: 'right' }}>
                        {formatMad(inv.paidAmount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <InvoiceDrawer
        invoice={selected}
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) setSelectedId(null);
        }}
      />
    </Screen>
  );
}

// Backward-compat: keep `EMPTY_FILTERS` reachable from tests via a re-export
export { EMPTY_FILTERS };
