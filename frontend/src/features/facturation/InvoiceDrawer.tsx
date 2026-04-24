/**
 * Invoice editor drawer.
 * Mode depends on invoice status:
 *   BROUILLON          → editable lines + discount, then "Émettre"
 *   EMISE              → "Encaisser" / "Avoir"
 *   PAYEE_PARTIELLE    → "Encaisser solde" / "Avoir"
 *   PAYEE_TOTALE       → "Avoir" only
 *   ANNULEE            → read-only
 */
import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Close, Plus, Trash, Eye } from '@/components/icons';
import { useNavigate } from 'react-router-dom';
import {
  useUpdateInvoice,
  useIssueInvoice,
  useRecordPayment,
  useCreditNote,
} from './hooks/useInvoiceMutations';
import {
  STATUS_LABEL,
  PAYMENT_MODE_LABEL,
  type InvoiceApi,
  type InvoiceLineDraft,
  type PaymentMode,
} from './types';
import './facturation.css';

interface InvoiceDrawerProps {
  invoice: InvoiceApi | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatMad(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} MAD`;
}

function emptyLine(): InvoiceLineDraft {
  return { description: '', quantity: 1, unitPrice: 0 };
}

export function InvoiceDrawer({ invoice, open, onOpenChange }: InvoiceDrawerProps) {
  const navigate = useNavigate();
  const [lines, setLines] = useState<InvoiceLineDraft[]>([emptyLine()]);
  const [discount, setDiscount] = useState<number>(0);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('ESPECES');
  const [paymentRef, setPaymentRef] = useState<string>('');

  const [creditOpen, setCreditOpen] = useState(false);
  const [creditReason, setCreditReason] = useState<string>('');

  const { updateInvoice, isPending: isSaving } = useUpdateInvoice();
  const { issueInvoice, isPending: isIssuing } = useIssueInvoice();
  const { recordPayment, isPending: isPaying } = useRecordPayment();
  const { issueCreditNote, isPending: isCrediting } = useCreditNote();

  useEffect(() => {
    if (invoice) {
      setLines(
        invoice.lines.length > 0
          ? invoice.lines.map((l) => ({
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
            }))
          : [emptyLine()],
      );
      setDiscount(invoice.discountAmount);
      const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
      setPaymentAmount(Math.max(0, invoice.netAmount - paid));
    }
  }, [invoice]);

  if (!invoice) return null;
  const inv = invoice;

  const isDraft = inv.status === 'BROUILLON';
  const isIssued = inv.status === 'EMISE' || inv.status === 'PAYEE_PARTIELLE';
  const isPaid = inv.status === 'PAYEE_TOTALE';
  const isCancelled = inv.status === 'ANNULEE';

  const totalAmount = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const netAmount = Math.max(0, totalAmount - discount);
  const paidSum = inv.payments.reduce((s, p) => s + p.amount, 0);
  const remainingDue = Math.max(0, inv.netAmount - paidSum);

  function updateLine(i: number, patch: Partial<InvoiceLineDraft>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLine(i: number) {
    setLines((ls) => (ls.length === 1 ? [emptyLine()] : ls.filter((_, idx) => idx !== i)));
  }

  async function handleSaveDraft() {
    const valid = lines.filter((l) => l.description.trim().length > 0 && l.unitPrice > 0);
    if (valid.length === 0) {
      toast.error('Ajoutez au moins une ligne valide.');
      return;
    }
    try {
      await updateInvoice({ id: inv.id, lines: valid, discountAmount: discount });
      toast.success('Brouillon enregistré.');
    } catch {
      toast.error('Échec de la sauvegarde.');
    }
  }

  async function handleIssue() {
    try {
      const res = await issueInvoice(inv.id);
      toast.success(`Facture émise · n° ${res.number}`);
    } catch {
      toast.error('Émission impossible.');
    }
  }

  async function handlePay() {
    if (paymentAmount <= 0) {
      toast.error('Montant invalide.');
      return;
    }
    try {
      const payload: Parameters<typeof recordPayment>[0] = {
        id: inv.id,
        amount: paymentAmount,
        mode: paymentMode,
      };
      if (paymentRef) payload.reference = paymentRef;
      await recordPayment(payload);
      toast.success('Paiement enregistré.');
      setPaymentOpen(false);
      setPaymentRef('');
    } catch {
      toast.error('Paiement refusé.');
    }
  }

  async function handleCredit() {
    if (creditReason.trim().length < 3) {
      toast.error('Raison requise (3 caractères min).');
      return;
    }
    try {
      await issueCreditNote({ id: inv.id, reason: creditReason });
      toast.success('Avoir émis.');
      setCreditOpen(false);
      setCreditReason('');
    } catch {
      toast.error('Avoir refusé.');
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fa-overlay" />
        <Dialog.Content className="fa-drawer" aria-label="Facture">
          <div className="fa-header">
            <div style={{ flex: 1 }}>
              <Dialog.Title style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                Facture {invoice.number ?? `(brouillon ${invoice.id.slice(0, 8)})`}
              </Dialog.Title>
              <Dialog.Description style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0 }}>
                {STATUS_LABEL[invoice.status]} ·{' '}
                {invoice.issuedAt
                  ? new Date(invoice.issuedAt).toLocaleString('fr-MA')
                  : new Date(invoice.createdAt).toLocaleString('fr-MA')}
              </Dialog.Description>
            </div>
            <Button
              size="sm"
              onClick={() => navigate(`/facturation/${invoice.id}/apercu`)}
              disabled={isDraft}
            >
              <Eye /> Aperçu
            </Button>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label="Fermer">
                <Close />
              </Button>
            </Dialog.Close>
          </div>

          <div className="fa-body scroll">
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
              Lignes
            </div>

            <div
              className="fa-line"
              style={{ borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase' }}
            >
              <div>Description</div>
              <div>Quantité</div>
              <div>Prix unitaire</div>
              <div>Total</div>
              <div />
            </div>

            {lines.map((l, i) => {
              const lineTotal = l.quantity * l.unitPrice;
              return (
                <div key={i} className="fa-line">
                  <input
                    placeholder="Consultation, acte…"
                    value={l.description}
                    disabled={!isDraft}
                    onChange={(e) => updateLine(i, { description: e.target.value })}
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={l.quantity}
                    disabled={!isDraft}
                    onChange={(e) => updateLine(i, { quantity: Number(e.target.value) || 0 })}
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={l.unitPrice}
                    disabled={!isDraft}
                    onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) || 0 })}
                  />
                  <div className="tnum" style={{ fontSize: 12.5 }}>
                    {formatMad(lineTotal)}
                  </div>
                  {isDraft && (
                    <Button variant="ghost" size="sm" iconOnly aria-label="Supprimer ligne" onClick={() => removeLine(i)}>
                      <Trash />
                    </Button>
                  )}
                </div>
              );
            })}

            {isDraft && (
              <Button
                style={{ width: '100%', marginTop: 10, justifyContent: 'center' }}
                onClick={() => setLines((ls) => [...ls, emptyLine()])}
              >
                <Plus /> Ajouter une ligne
              </Button>
            )}

            <div className="fa-totals">
              <div className="fa-totals-row">
                <span>Sous-total</span>
                <span className="tnum">{formatMad(isDraft ? totalAmount : invoice.totalAmount)}</span>
              </div>
              <div className="fa-totals-row">
                <span>Remise</span>
                {isDraft ? (
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                    style={{
                      width: 100,
                      height: 28,
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      padding: '0 8px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  />
                ) : (
                  <span className="tnum">{formatMad(invoice.discountAmount)}</span>
                )}
              </div>
              <div className="fa-totals-row fa-totals-net">
                <span>Net à payer</span>
                <span className="tnum">{formatMad(isDraft ? netAmount : invoice.netAmount)}</span>
              </div>
              {!isDraft && paidSum > 0 && (
                <div className="fa-totals-row" style={{ color: 'var(--ink-3)' }}>
                  <span>Déjà encaissé</span>
                  <span className="tnum">{formatMad(paidSum)}</span>
                </div>
              )}
              {!isDraft && remainingDue > 0 && (
                <div className="fa-totals-row" style={{ color: 'var(--amber)', fontWeight: 600 }}>
                  <span>Reste à régler</span>
                  <span className="tnum">{formatMad(remainingDue)}</span>
                </div>
              )}
            </div>

            {invoice.payments.length > 0 && (
              <>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--ink-3)',
                    margin: '18px 0 8px',
                  }}
                >
                  Paiements
                </div>
                <div style={{ fontSize: 12.5 }}>
                  {invoice.payments.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '6px 0',
                        borderBottom: '1px dashed var(--border)',
                      }}
                    >
                      <span>
                        {new Date(p.paidAt).toLocaleString('fr-MA')} · {PAYMENT_MODE_LABEL[p.mode]}
                        {p.reference ? ` · ${p.reference}` : ''}
                      </span>
                      <span className="tnum">{formatMad(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="fa-footer">
            <Dialog.Close asChild>
              <Button>Fermer</Button>
            </Dialog.Close>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {isDraft && (
                <>
                  <Button onClick={() => void handleSaveDraft()} disabled={isSaving}>
                    {isSaving ? 'Enregistrement…' : 'Enregistrer brouillon'}
                  </Button>
                  <Button variant="primary" onClick={() => void handleIssue()} disabled={isIssuing}>
                    {isIssuing ? 'Émission…' : 'Émettre →'}
                  </Button>
                </>
              )}
              {isIssued && (
                <>
                  <Button onClick={() => setCreditOpen(true)}>Avoir</Button>
                  <Button variant="primary" onClick={() => setPaymentOpen(true)}>
                    Encaisser
                  </Button>
                </>
              )}
              {isPaid && (
                <Button onClick={() => setCreditOpen(true)}>Avoir</Button>
              )}
              {isCancelled && (
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Facture annulée.</span>
              )}
            </div>
          </div>
        </Dialog.Content>

        {/* Payment dialog */}
        {paymentOpen && (
          <Dialog.Root open={paymentOpen} onOpenChange={setPaymentOpen}>
            <Dialog.Portal>
              <Dialog.Overlay className="fa-overlay" style={{ zIndex: 102 }} />
              <Dialog.Content
                style={{
                  position: 'fixed',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)',
                  padding: 24,
                  width: 400,
                  zIndex: 103,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                }}
              >
                <Dialog.Title style={{ fontSize: 15, fontWeight: 600, margin: 0, marginBottom: 12 }}>
                  Encaisser un paiement
                </Dialog.Title>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>Montant (MAD)</label>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value) || 0)}
                    style={{
                      height: 36,
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '0 10px',
                      fontSize: 14,
                    }}
                  />
                  <label style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                    style={{
                      height: 36,
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '0 10px',
                      fontSize: 13,
                      fontFamily: 'inherit',
                      background: 'var(--surface)',
                    }}
                  >
                    {(Object.entries(PAYMENT_MODE_LABEL) as [PaymentMode, string][]).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <label style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>Référence (optionnel)</label>
                  <input
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="N° chèque, dernière transaction…"
                    style={{
                      height: 36,
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '0 10px',
                      fontSize: 13,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
                  <Dialog.Close asChild>
                    <Button>Annuler</Button>
                  </Dialog.Close>
                  <Button
                    variant="primary"
                    onClick={() => void handlePay()}
                    disabled={isPaying || paymentAmount <= 0}
                  >
                    {isPaying ? 'Paiement…' : 'Encaisser'}
                  </Button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        )}

        {/* Credit note dialog */}
        {creditOpen && (
          <Dialog.Root open={creditOpen} onOpenChange={setCreditOpen}>
            <Dialog.Portal>
              <Dialog.Overlay className="fa-overlay" style={{ zIndex: 102 }} />
              <Dialog.Content
                style={{
                  position: 'fixed',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)',
                  padding: 24,
                  width: 400,
                  zIndex: 103,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                }}
              >
                <Dialog.Title style={{ fontSize: 15, fontWeight: 600, margin: 0, marginBottom: 6 }}>
                  Émettre un avoir
                </Dialog.Title>
                <Dialog.Description style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 14 }}>
                  Cette action annule la facture originale et génère un avoir avec un numéro AYYYY-NNNNNN.
                </Dialog.Description>
                <textarea
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  placeholder="Raison de l'avoir…"
                  style={{
                    width: '100%',
                    minHeight: 80,
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: 10,
                    fontFamily: 'inherit',
                    fontSize: 13,
                  }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
                  <Dialog.Close asChild>
                    <Button>Annuler</Button>
                  </Dialog.Close>
                  <Button
                    variant="primary"
                    onClick={() => void handleCredit()}
                    disabled={isCrediting || creditReason.trim().length < 3}
                  >
                    {isCrediting ? 'Émission…' : 'Émettre avoir'}
                  </Button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}
