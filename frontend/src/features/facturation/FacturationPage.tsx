/**
 * Screen 09 — Facturation (desktop).
 * List of invoices, filter by status, click row to open drawer.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { useInvoices } from './hooks/useInvoices';
import { InvoiceDrawer } from './InvoiceDrawer';
import { STATUS_LABEL, type InvoiceApi, type InvoiceStatus } from './types';
import './facturation.css';

const NAV_MAP = {
  agenda: '/agenda',
  patients: '/patients',
  salle: '/salle',
  consult: '/consultations',
  factu: '/facturation',
  catalogue: '/catalogue',
          params: '/parametres',
} as const;

const FILTERS: { key: InvoiceStatus | 'ALL'; label: string }[] = [
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

export default function FacturationPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<InvoiceStatus | 'ALL'>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { invoices, isLoading, error } = useInvoices(filter);

  const selected = useMemo<InvoiceApi | null>(
    () => invoices.find((i) => i.id === selectedId) ?? null,
    [invoices, selectedId],
  );

  const totalNet = invoices.reduce((s, i) => s + i.netAmount, 0);
  const totalPaid = invoices.reduce(
    (s, i) => s + i.payments.reduce((p, x) => p + x.amount, 0),
    0,
  );

  return (
    <Screen
      active="factu"
      title="Facturation"
      sub={`${invoices.length} facture${invoices.length > 1 ? 's' : ''}`}
      onNavigate={(navId) => navigate(NAV_MAP[navId])}
    >
      <div className="fa-scroll scroll">
        <div className="fa-filters" role="tablist" aria-label="Filtres statut">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              className={`fa-filter-btn${filter === f.key ? ' active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
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
                {formatMad(Math.max(0, totalNet - totalPaid))}
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

          {!isLoading && invoices.length === 0 && !error && (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                color: 'var(--ink-3)',
                fontSize: 13,
              }}
            >
              Aucune facture pour ce filtre.
            </div>
          )}

          {invoices.length > 0 && (
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
                {invoices.map((inv) => {
                  const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
                  const date = inv.issuedAt ?? inv.createdAt;
                  return (
                    <tr key={inv.id} onClick={() => setSelectedId(inv.id)}>
                      <td>
                        <span className="mono" style={{ fontSize: 12 }}>
                          {inv.number ?? `BR-${inv.id.slice(0, 8).toUpperCase()}`}
                        </span>
                      </td>
                      <td>
                        <span className="mono" style={{ fontSize: 12 }}>
                          {inv.patientId.slice(0, 8).toUpperCase()}
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
                        {formatMad(paid)}
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
