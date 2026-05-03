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

/**
 * Map invoice status to a mobile-pill variant from `mobile.css`. We avoid the
 * desktop-only `fa-status-pill` class (hardcoded hex colors) because it bypasses
 * the mobile token system.
 */
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

        {/* KPI strip */}
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
                      Patient {inv.patientId.slice(0, 8).toUpperCase()} ·{' '}
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
                    {paid > 0 && (
                      <div
                        className="tnum"
                        style={{ fontSize: 11, color: 'var(--success)', marginTop: 2 }}
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
