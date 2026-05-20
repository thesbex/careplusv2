/**
 * Dialog "Suspendre la consultation" — propose au médecin deux issues :
 *
 *   1. Remettre le patient en salle d'attente (suspend simple, comportement
 *      historique : consultation → SUSPENDUE, RDV → CONSTANTES_PRISES,
 *      réapparait dans /queue).
 *   2. Annuler le rendez-vous (suspend + DELETE appointment avec raison →
 *      RDV → ANNULE, le patient sort du flux du jour).
 *
 * Côté serveur on orchestre côté client : suspend() puis cancel() dans
 * la branche annulation. Les deux endpoints existent déjà.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field, FieldLabel } from '@/components/ui/Field';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Suspend la consultation (PUT vers SUSPENDUE + RDV → CONSTANTES_PRISES). */
  onSuspend: () => Promise<boolean>;
  /** Annule le rendez-vous lié (DELETE avec raison). */
  onCancel: (reason: string) => Promise<void>;
  /** true si la consultation n'a pas de RDV — masque la branche "Annuler". */
  hideCancelBranch?: boolean;
  onSuspended?: () => void;
  onCancelled?: () => void;
}

export function SuspendChoiceDialog({
  open,
  onOpenChange,
  onSuspend,
  onCancel,
  hideCancelBranch = false,
  onSuspended,
  onCancelled,
}: Props) {
  const [mode, setMode] = useState<'choice' | 'cancel'>('choice');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  function close() {
    setMode('choice');
    setReason('');
    onOpenChange(false);
  }

  async function handleResume() {
    setBusy(true);
    try {
      const ok = await onSuspend();
      if (!ok) {
        toast.error('Suspension refusée par le serveur.');
        return;
      }
      toast.success('Consultation suspendue. Patient remis dans la file.');
      onSuspended?.();
      close();
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelConfirm() {
    if (reason.trim().length < 3) {
      toast.error('Raison requise (3 caractères min).');
      return;
    }
    setBusy(true);
    try {
      // 1) Suspend la consultation pour la sortir du flux actif.
      const ok = await onSuspend();
      if (!ok) {
        toast.error('Suspension refusée par le serveur.');
        return;
      }
      // 2) Annule le RDV lié.
      try {
        await onCancel(reason.trim());
      } catch {
        toast.error("Consultation suspendue mais annulation du RDV refusée.");
        return;
      }
      toast.success('Consultation suspendue, rendez-vous annulé.');
      onCancelled?.();
      close();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Suspendre la consultation"
      data-testid="suspend-choice-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.45)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          width: 'min(480px, calc(100vw - 32px))',
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600 }}>
          Suspendre la consultation
        </div>

        {mode === 'choice' && (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
              Que voulez-vous faire du rendez-vous ?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                data-testid="suspend-choice-resume"
                disabled={busy}
                onClick={() => void handleResume()}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  border: '1px solid var(--primary)',
                  background: 'var(--primary-soft)',
                  color: 'var(--primary)',
                  borderRadius: 8,
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                ↩ Remettre le patient en salle d'attente
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 400, marginTop: 4 }}>
                  Le patient réapparaît dans la file d'attente, la consultation
                  reprend dès la première saisie.
                </div>
              </button>
              {!hideCancelBranch && (
                <button
                  type="button"
                  data-testid="suspend-choice-cancel"
                  disabled={busy}
                  onClick={() => setMode('cancel')}
                  style={{
                    textAlign: 'left',
                    padding: '12px 14px',
                    border: '1px solid var(--danger)',
                    background: 'var(--surface)',
                    color: 'var(--danger)',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: busy ? 'not-allowed' : 'pointer',
                  }}
                >
                  ✕ Annuler le rendez-vous
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 400, marginTop: 4 }}>
                    Le patient sort du flux du jour. Une raison est requise.
                  </div>
                </button>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={close} disabled={busy}>
                Fermer
              </Button>
            </div>
          </>
        )}

        {mode === 'cancel' && (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
              Indiquez la raison de l'annulation (visible dans l'historique du
              patient).
            </div>
            <Field>
              <FieldLabel htmlFor="suspend-cancel-reason">Raison *</FieldLabel>
              <textarea
                id="suspend-cancel-reason"
                data-testid="suspend-cancel-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={busy}
                placeholder="Empêchement, patient parti sans attendre, …"
                style={{
                  width: '100%',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: 8,
                  fontSize: 13,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  background: 'var(--surface)',
                }}
              />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <Button onClick={() => setMode('choice')} disabled={busy}>
                ← Retour
              </Button>
              <Button
                variant="primary"
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                disabled={busy || reason.trim().length < 3}
                onClick={() => void handleCancelConfirm()}
              >
                {busy ? 'Annulation…' : "Confirmer l'annulation"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
