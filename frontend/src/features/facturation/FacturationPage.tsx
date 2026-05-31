/**
 * Screen 09 — Facturation (desktop).
 * Liste des factures avec filtres avancés (dates, modes, patient, montants),
 * KPIs agrégés sur le résultat filtré, et export CSV / xlsx.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Input';
import { useAuthStore } from '@/lib/auth/authStore';
import { useT } from '@/lib/i18n/I18nProvider';
import { usePractitioners } from '../agenda/hooks/usePractitioners';
import { useInvoice } from './hooks/useInvoices';
import { useInvoiceSearch } from './hooks/useInvoiceSearch';
import { InvoiceDrawer } from './InvoiceDrawer';
import { CaisseTodayPanel } from '../caisse/CaisseTodayPanel';
import { AdvancedFiltersPopover } from './AdvancedFiltersPopover';
import { ExportButton } from './ExportButton';
import {
  EMPTY_FILTERS,
  invoiceStatusKey,
  type InvoiceSearchFilters,
  type InvoiceStatus,
} from './types';
import './facturation.css';

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

const STATUS_FILTERS: { key: InvoiceStatus | 'ALL'; labelKey: string }[] = [
  { key: 'ALL', labelKey: 'factu.filter.all' },
  { key: 'BROUILLON', labelKey: 'factu.filter.drafts' },
  { key: 'EMISE', labelKey: 'factu.filter.issued' },
  { key: 'PAYEE_PARTIELLE', labelKey: 'factu.filter.partial' },
  { key: 'PAYEE_TOTALE', labelKey: 'factu.filter.paid' },
  { key: 'ANNULEE', labelKey: 'factu.filter.cancelled' },
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
    medecinId: params.get('medecinId'),
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
  if (f.medecinId) p.set('medecinId', f.medecinId);
  return p;
}

export default function FacturationPage() {
  const navigate = useNavigate();
  const { t } = useT();
  const [urlParams, setUrlParams] = useSearchParams();
  const [filters, setFilters] = useState<InvoiceSearchFilters>(() => filtersFromUrl(urlParams));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // QA10-4 — deep-link `?invoice=<id>` (ex. après "Générer facture de séjour" :
  // toast « Ouverture dans Facturation »). On ouvre directement le tiroir de
  // cette facture : une facture séjour est en BROUILLON et tombe en bas de la
  // liste (tri émission DESC NULLS LAST), donc l'utilisateur ne la « retrouvait »
  // pas. Capturé une fois au montage avant que la synchro filtres→URL ne le retire.
  const [deepLinkInvoice] = useState<string | null>(() => urlParams.get('invoice'));
  useEffect(() => {
    if (deepLinkInvoice) setSelectedId(deepLinkInvoice);
  }, [deepLinkInvoice]);

  // Sync filter state → URL
  useEffect(() => {
    setUrlParams(filtersToUrl(filters), { replace: true });
  }, [filters, setUrlParams]);

  // Multi-praticien : sélecteur médecin visible dès ≥2 praticiens actifs.
  const { data: practitioners } = usePractitioners();
  const activePractitioners = useMemo(
    () => practitioners.filter((p) => p.active),
    [practitioners],
  );
  const showPractitionerSelector = activePractitioners.length >= 2;

  const statusChip: InvoiceStatus | 'ALL' =
    filters.statuses.length === 1 ? (filters.statuses[0] ?? 'ALL') : 'ALL';

  function setStatusChip(s: InvoiceStatus | 'ALL') {
    setFilters({ ...filters, statuses: s === 'ALL' ? [] : [s] });
  }

  function setMedecinFilter(id: string | null) {
    setFilters({ ...filters, medecinId: id });
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
      title={t('factu.title')}
      sub={t('factu.count', { n: totalCount, s: totalCount > 1 ? 's' : '' })}
      onNavigate={(navId) => navigate(NAV_MAP[navId])}
    >
      <div className="fa-scroll scroll">
        <CaisseTodayPanel />

        <div className="fa-toolbar">
          <div className="fa-filters" role="tablist" aria-label={t('factu.filtersAria')}>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={statusChip === f.key}
                className={`fa-filter-btn${statusChip === f.key ? ' active' : ''}`}
                onClick={() => setStatusChip(f.key)}
              >
                {t(f.labelKey)}
              </button>
            ))}
          </div>
          <div className="fa-toolbar-end">
            {showPractitionerSelector && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  color: 'var(--ink-2)',
                }}
              >
                {t('factu.doctor')}
                <Select
                  aria-label={t('factu.doctor.filterAria')}
                  value={filters.medecinId ?? 'ALL'}
                  onChange={(e) =>
                    setMedecinFilter(e.target.value === 'ALL' ? null : e.target.value)
                  }
                  style={{
                    height: 28,
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '0 8px',
                    fontSize: 12.5,
                    fontFamily: 'inherit',
                    background: 'var(--surface)',
                  }}
                >
                  <option value="ALL">{t('factu.doctor.all')}</option>
                  {activePractitioners.map((p) => (
                    <option key={p.id} value={p.id}>
                      Dr {p.lastName} {p.firstName}
                      {p.specialty ? ` — ${p.specialty}` : ''}
                    </option>
                  ))}
                </Select>
              </label>
            )}
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
                {t('factu.kpi.totalNet')}
              </div>
              <div className="tnum" style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
                {formatMad(totalNet)}
              </div>
            </div>
          </Panel>
          <Panel>
            <div style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase' }}>
                {t('factu.kpi.collected')}
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
                {t('factu.kpi.toCollect')}
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
            <span>{t('factu.list.title')}</span>
          </PanelHeader>

          {isLoading && (
            <div style={{ padding: 20, color: 'var(--ink-3)', fontSize: 13 }}>
              {t('common.loading')}
            </div>
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
              {t('factu.list.empty')}
            </div>
          )}

          {items.length > 0 && (
            <table className="fa-table" style={{ borderRadius: 0, border: 'none' }}>
              <thead>
                <tr>
                  <th>{t('factu.col.number')}</th>
                  <th>{t('factu.col.patient')}</th>
                  <th>{t('factu.col.date')}</th>
                  <th>{t('factu.col.status')}</th>
                  <th style={{ textAlign: 'right' }}>{t('factu.col.totalNet')}</th>
                  <th style={{ textAlign: 'right' }}>{t('factu.col.collected')}</th>
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
                          {t(invoiceStatusKey(inv.status))}
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
