/**
 * Aperçu facture — A4 print-ready preview.
 * Uses an <A4> primitive (inline styles for now).
 */
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, Print } from '@/components/icons';
import { useT } from '@/lib/i18n/I18nProvider';
import { useInvoice } from './hooks/useInvoices';
import { invoiceStatusKey, paymentModeKey } from './types';
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

function formatMad(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} MAD`;
}

export default function ApercuFacturePage() {
  const navigate = useNavigate();
  const { t } = useT();
  const { id } = useParams<{ id: string }>();
  const { invoice, isLoading, error } = useInvoice(id);

  return (
    <Screen
      active="factu"
      title={t('factu.preview.title')}
      sub={invoice?.number ?? t('factu.preview.draftSub', { id: id?.slice(0, 8).toUpperCase() ?? '' })}
      topbarRight={
        <>
          <Button onClick={() => navigate(-1)}>
            <ChevronLeft /> {t('factu.preview.back')}
          </Button>
          <Button variant="primary" onClick={() => window.print()} disabled={!invoice}>
            <Print /> {t('factu.preview.print')}
          </Button>
        </>
      }
      onNavigate={(navId) => navigate(NAV_MAP[navId])}
    >
      <div style={{ background: 'var(--bg-alt)', overflow: 'auto', height: '100%' }}>
        {isLoading && (
          <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>{t('common.loading')}</div>
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
                  {t('factu.preview.practiceName')}
                </div>
                <div style={{ fontSize: 11, color: '#555', marginTop: 4, lineHeight: 1.5 }}>
                  {t('factu.preview.practiceRole')}
                  <br />
                  {t('factu.preview.ordreLine')}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 11, color: '#555', lineHeight: 1.6 }}>
                <div style={{ fontWeight: 600, color: '#111' }}>{t('factu.preview.invoiceLabel')}</div>
                {t('factu.preview.cityDate', {
                  date: new Date(invoice.issuedAt ?? invoice.createdAt).toLocaleDateString('fr-MA'),
                })}
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
                  {t('factu.preview.patient')}
                </div>
                <div className="mono" style={{ fontSize: 13, fontWeight: 600, marginTop: 3 }}>
                  {invoice.patientId.slice(0, 8).toUpperCase()}
                </div>
                {invoice.mutuelleInsuranceName && (
                  <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>
                    {t('factu.preview.mutuelle', { name: invoice.mutuelleInsuranceName })}
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
                  {t('factu.preview.number')}
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 14, fontWeight: 600, marginTop: 3, color: '#1E5AA8' }}
                >
                  {invoice.number ?? t('factu.preview.draftValue')}
                </div>
                <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>
                  {t('factu.preview.statusLine', { status: t(invoiceStatusKey(invoice.status)) })}
                </div>
              </div>
            </div>

            <div className="fa-a4-title">{t('factu.preview.docTitle')}</div>

            <table className="fa-a4-table">
              <thead>
                <tr>
                  <th>{t('factu.preview.col.description')}</th>
                  <th className="right">{t('factu.preview.col.qty')}</th>
                  <th className="right">{t('factu.preview.col.unitPrice')}</th>
                  <th className="right">{t('factu.preview.col.total')}</th>
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
                    <td>{t('factu.preview.subtotal')}</td>
                    <td className="right">{formatMad(invoice.totalAmount)}</td>
                  </tr>
                  {invoice.discountAmount > 0 && (
                    <tr>
                      <td>{t('factu.preview.discount')}</td>
                      <td className="right">- {formatMad(invoice.discountAmount)}</td>
                    </tr>
                  )}
                  <tr className="net">
                    <td>{t('factu.preview.netDue')}</td>
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
                  {t('factu.preview.payments')}
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
                      {t(paymentModeKey(p.mode))}
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
