/**
 * Caisse quotidienne — panneau live des encaissements du jour.
 * Self-resetting : la requête backend est bornée à [date 00h00, date+1 00h00[
 * en TZ Africa/Casablanca, donc à minuit la caisse repart naturellement à zéro.
 */
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { PAYMENT_MODE_LABEL, type PaymentMode } from '../facturation/types';
import { useCaisseToday } from './hooks/useCaisseToday';

function formatMad(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} MAD`;
}

const MODE_ORDER: PaymentMode[] = ['ESPECES', 'CHEQUE', 'CB', 'VIREMENT', 'TIERS_PAYANT'];

export function CaisseTodayPanel() {
  const { caisse, isLoading, error } = useCaisseToday();

  const dateLabel = caisse
    ? new Date(caisse.date + 'T00:00:00').toLocaleDateString('fr-MA', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '';

  const byModeMap = new Map(caisse?.byMode.map((m) => [m.mode, m]) ?? []);

  return (
    <Panel style={{ padding: 0, marginBottom: 14 }}>
      <PanelHeader>
        <span>Caisse du jour {dateLabel ? `· ${dateLabel}` : ''}</span>
      </PanelHeader>
      {isLoading && (
        <div style={{ padding: 16, color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</div>
      )}
      {error && (
        <div style={{ padding: 16, color: 'var(--danger)', fontSize: 13 }}>{error}</div>
      )}
      {caisse && !isLoading && !error && (
        <div style={{ padding: 14 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                background: 'var(--surface-2, #f6f7fb)',
                borderRadius: 'var(--r-md)',
                padding: '10px 14px',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--ink-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Encaissé aujourd'hui
              </div>
              <div
                className="tnum"
                style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: '#2E7D32' }}
              >
                {formatMad(caisse.total)}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                {caisse.count} paiement{caisse.count > 1 ? 's' : ''}
              </div>
            </div>
            <div
              style={{
                background: 'var(--surface-2, #f6f7fb)',
                borderRadius: 'var(--r-md)',
                padding: '10px 14px',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--ink-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Factures émises
              </div>
              <div className="tnum" style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                {formatMad(caisse.invoicesIssuedTotal)}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                {caisse.invoicesIssuedCount} facture
                {caisse.invoicesIssuedCount > 1 ? 's' : ''}
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--ink-3)',
              marginBottom: 8,
            }}
          >
            Par mode de paiement
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {MODE_ORDER.map((m) => {
              const row = byModeMap.get(m);
              const amount = row?.amount ?? 0;
              const cnt = row?.count ?? 0;
              return (
                <div
                  key={m}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-sm, 6px)',
                    padding: '8px 10px',
                  }}
                >
                  <div
                    style={{
                      fontSize: 10.5,
                      color: 'var(--ink-3)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {PAYMENT_MODE_LABEL[m]}
                  </div>
                  <div
                    className="tnum"
                    style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}
                  >
                    {formatMad(amount)}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
                    {cnt} encaissement{cnt > 1 ? 's' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  );
}
