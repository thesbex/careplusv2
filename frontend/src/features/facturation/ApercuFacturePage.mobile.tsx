/**
 * Aperçu facture (mobile) — vertical card-style summary, optimized for 390px.
 * The desktop version renders an A4 sheet; that's not usable on a phone, so
 * we present the same data in a stacked card layout with a Print button.
 */
import { useNavigate, useParams } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { Print } from '@/components/icons';
import { useInvoice } from './hooks/useInvoices';
import { STATUS_LABEL, PAYMENT_MODE_LABEL } from './types';
import './facturation.css';

const TAB_MAP: Record<MobileTab, string> = {
  agenda:   '/agenda',
  salle:    '/salle',
  patients: '/patients',
  factu:    '/facturation',
  menu:     '/parametres',
};

function formatMad(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} MAD`;
}

export default function ApercuFactureMobilePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { invoice, isLoading, error } = useInvoice(id);

  return (
    <MScreen
      tab="factu"
      noTabs
      onTabChange={(t) => navigate(TAB_MAP[t])}
      topbar={
        <MTopbar
          left={<MIconBtn icon="ChevronLeft" label="Retour" onClick={() => navigate(-1)} />}
          title="Aperçu facture"
          sub={invoice?.number ?? (id ? `BR-${id.slice(0, 8).toUpperCase()}` : '')}
        />
      }
    >
      <div className="mb-pad">
        {isLoading && (
          <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '12px 0' }}>
            Chargement…
          </div>
        )}
        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 13, padding: '12px 0' }}>
            {error}
          </div>
        )}
        {invoice && (
          <>
            {/* Header card */}
            <div className="m-card" style={{ marginBottom: 14, padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Numéro
              </div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)', marginTop: 4 }}>
                {invoice.number ?? 'BROUILLON'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>
                Émise le{' '}
                {new Date(invoice.issuedAt ?? invoice.createdAt).toLocaleDateString('fr-MA')}
                {' · '}
                <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>
                  {STATUS_LABEL[invoice.status]}
                </span>
              </div>
              {invoice.mutuelleInsuranceName && (
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
                  Mutuelle : {invoice.mutuelleInsuranceName}
                </div>
              )}
            </div>

            {/* Lines */}
            <div className="m-section-h">
              <h3>Lignes</h3>
            </div>
            <div className="m-card" style={{ marginBottom: 14 }}>
              {invoice.lines.length === 0 ? (
                <div style={{ padding: 16, color: 'var(--ink-3)', fontSize: 13 }}>
                  Aucune ligne.
                </div>
              ) : (
                invoice.lines.map((l, i) => (
                  <div
                    key={l.id}
                    style={{
                      padding: '12px 14px',
                      borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{l.description}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                        {l.quantity} × {formatMad(l.unitPrice)}
                      </div>
                    </div>
                    <div className="tnum" style={{ fontSize: 13, fontWeight: 600 }}>
                      {formatMad(l.totalPrice)}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Totals */}
            <div className="m-card" style={{ marginBottom: 14, padding: 16 }}>
              <Row label="Sous-total" value={formatMad(invoice.totalAmount)} />
              {invoice.discountAmount > 0 && (
                <Row label="Remise" value={`- ${formatMad(invoice.discountAmount)}`} />
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border)',
                  marginTop: 8,
                  paddingTop: 10,
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                <span>Net à payer</span>
                <span className="tnum">{formatMad(invoice.netAmount)}</span>
              </div>
            </div>

            {/* Payments */}
            {invoice.payments.length > 0 && (
              <>
                <div className="m-section-h">
                  <h3>Paiements</h3>
                </div>
                <div className="m-card" style={{ marginBottom: 14 }}>
                  {invoice.payments.map((p, i) => (
                    <div
                      key={p.id}
                      style={{
                        padding: '12px 14px',
                        borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {PAYMENT_MODE_LABEL[p.mode]}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                          {new Date(p.paidAt).toLocaleDateString('fr-MA')}
                          {p.reference ? ` · ${p.reference}` : ''}
                        </div>
                      </div>
                      <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: '#2E7D32' }}>
                        {formatMad(p.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <button
              type="button"
              className="m-btn"
              style={{ height: 44, width: '100%' }}
              onClick={() => window.print()}
            >
              <Print aria-hidden="true" /> Imprimer
            </button>
          </>
        )}
      </div>
    </MScreen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '4px 0',
        fontSize: 13,
      }}
    >
      <span style={{ color: 'var(--ink-3)' }}>{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}
