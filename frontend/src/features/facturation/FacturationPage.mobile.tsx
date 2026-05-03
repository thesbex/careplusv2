/**
 * Screen 09 — Facturation (mobile).
 * Compact list view with status filter chips and KPI strip.
 * Tapping a row opens the desktop InvoiceDrawer (acceptable on phones —
 * it covers the full screen via overlay).
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { ChevronRight } from '@/components/icons';
import { useInvoices } from './hooks/useInvoices';
import { InvoiceDrawer } from './InvoiceDrawer';
import { STATUS_LABEL, type InvoiceApi, type InvoiceStatus } from './types';
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

export default function FacturationMobilePage() {
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
    <MScreen
      tab="factu"
      topbar={<MTopbar brand title="Facturation" />}
      onTabChange={(t) => navigate(TAB_MAP[t])}
    >
      <div className="mb-pad">
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 12 }}>
          {invoices.length} facture{invoices.length > 1 ? 's' : ''}
        </div>

        {/* KPI strip — 2x1 grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginBottom: 14,
          }}
        >
          <div className="m-stat">
            <div className="m-stat-k">Encaissé</div>
            <div className="m-stat-v" style={{ color: '#2E7D32', fontSize: 16 }}>
              {formatMad(totalPaid)}
            </div>
          </div>
          <div className="m-stat">
            <div className="m-stat-k">À encaisser</div>
            <div className="m-stat-v" style={{ color: 'var(--amber)', fontSize: 16 }}>
              {formatMad(Math.max(0, totalNet - totalPaid))}
            </div>
          </div>
        </div>

        {/* Filter chips — horizontal scroll */}
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
          }}
        >
          {FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setFilter(f.key)}
                style={{
                  flexShrink: 0,
                  height: 32,
                  padding: '0 14px',
                  borderRadius: 16,
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
          ) : invoices.length === 0 ? (
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
          ) : (
            invoices.map((inv, i) => {
              const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
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
                      <span className={`fa-status-pill ${STATUS_CLASS[inv.status]}`}>
                        {STATUS_LABEL[inv.status]}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: 'var(--ink-3)',
                        marginTop: 2,
                      }}
                    >
                      Patient {inv.patientId.slice(0, 8).toUpperCase()} ·{' '}
                      {new Date(date).toLocaleDateString('fr-MA')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="tnum" style={{ fontSize: 13, fontWeight: 600 }}>
                      {formatMad(inv.netAmount)}
                    </div>
                    {paid > 0 && (
                      <div
                        className="tnum"
                        style={{ fontSize: 11, color: '#2E7D32', marginTop: 2 }}
                      >
                        {formatMad(paid)} payé
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
