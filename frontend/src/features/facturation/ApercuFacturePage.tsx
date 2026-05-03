/**
 * Aperçu facture — A4 print-ready preview.
 * Uses an <A4> primitive (inline styles for now).
 */
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, Print } from '@/components/icons';
import { useInvoice } from './hooks/useInvoices';
import { STATUS_LABEL, PAYMENT_MODE_LABEL } from './types';
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

function formatMad(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} MAD`;
}

export default function ApercuFacturePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { invoice, isLoading, error } = useInvoice(id);

  return (
    <Screen
      active="factu"
      title="Aperçu — Facture"
      sub={invoice?.number ?? `Brouillon ${id?.slice(0, 8).toUpperCase()}`}
      topbarRight={
        <>
          <Button onClick={() => navigate(-1)}>
            <ChevronLeft /> Retour
          </Button>
          <Button variant="primary" onClick={() => window.print()} disabled={!invoice}>
            <Print /> Imprimer
          </Button>
        </>
      }
      onNavigate={(navId) => navigate(NAV_MAP[navId])}
    >
      <div style={{ background: 'var(--bg-alt)', overflow: 'auto', height: '100%' }}>
        {isLoading && (
          <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</div>
        )}
        {error && <div style={{ padding: 24, color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
        {invoice && (
          <div className="fa-a4">
            <div className="fa-a4-letterhead">
              <div>
                <div
                  style={{
                    fontFamily: 'Instrument Serif, serif',
                    fontSize: 26,
                    color: '#1E5AA8',
                    lineHeight: 1,
                    letterSpacing: '-0.01em',
                  }}
                >
                  Cabinet Médical
                </div>
                <div style={{ fontSize: 11, color: '#555', marginTop: 4, lineHeight: 1.5 }}>
                  Médecin Généraliste
                  <br />
                  Inscrit à l&apos;Ordre National des Médecins
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 11, color: '#555', lineHeight: 1.6 }}>
                <div style={{ fontWeight: 600, color: '#111' }}>Facture</div>
                Casablanca, le{' '}
                {new Date(invoice.issuedAt ?? invoice.createdAt).toLocaleDateString('fr-MA')}
                <br />
                ICE 0000000000000 · RC 000000
                <br />
                IF 00000000 · CNSS 0000000
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 20,
                marginBottom: 18,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: '#888',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Patient
                </div>
                <div className="mono" style={{ fontSize: 13, fontWeight: 600, marginTop: 3 }}>
                  {invoice.patientId.slice(0, 8).toUpperCase()}
                </div>
                {invoice.mutuelleInsuranceName && (
                  <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>
                    Mutuelle : {invoice.mutuelleInsuranceName}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontSize: 10,
                    color: '#888',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Numéro
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 14, fontWeight: 600, marginTop: 3, color: '#1E5AA8' }}
                >
                  {invoice.number ?? 'BROUILLON'}
                </div>
                <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>
                  Statut : {STATUS_LABEL[invoice.status]}
                </div>
              </div>
            </div>

            <div className="fa-a4-title">Facture</div>

            <table className="fa-a4-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="right">Qté</th>
                  <th className="right">Prix unitaire</th>
                  <th className="right">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.description}</td>
                    <td className="right">{l.quantity}</td>
                    <td className="right">{formatMad(l.unitPrice)}</td>
                    <td className="right">{formatMad(l.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="fa-a4-totals">
              <table>
                <tbody>
                  <tr>
                    <td>Sous-total</td>
                    <td className="right">{formatMad(invoice.totalAmount)}</td>
                  </tr>
                  {invoice.discountAmount > 0 && (
                    <tr>
                      <td>Remise</td>
                      <td className="right">- {formatMad(invoice.discountAmount)}</td>
                    </tr>
                  )}
                  <tr className="net">
                    <td>Net à payer</td>
                    <td className="right">{formatMad(invoice.netAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {invoice.payments.length > 0 && (
              <div style={{ marginTop: 24, fontSize: 12 }}>
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: 6,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#666',
                  }}
                >
                  Paiements
                </div>
                {invoice.payments.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '4px 0',
                      borderBottom: '1px dashed #ddd',
                    }}
                  >
                    <span>
                      {new Date(p.paidAt).toLocaleDateString('fr-MA')} ·{' '}
                      {PAYMENT_MODE_LABEL[p.mode]}
                      {p.reference ? ` · ${p.reference}` : ''}
                    </span>
                    <span className="tnum">{formatMad(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="fa-a4-legal">
              ICE 0000000000000 · RC 000000 · IF 00000000 · CNSS 0000000 · careplus
            </div>
          </div>
        )}
      </div>
    </Screen>
  );
}
