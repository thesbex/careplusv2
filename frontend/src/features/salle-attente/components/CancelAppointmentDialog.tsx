/**
 * Modale "Retirer de la liste" — confirme l'annulation d'un RDV depuis la
 * salle d'attente avec un motif optionnel. Wrap autour de DELETE /api/appointments/{id}.
 */
import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Close } from '@/components/icons';
import { useT } from '@/lib/i18n/I18nProvider';
import { useCancelAppointment } from '../hooks/useCancelAppointment';

interface CancelAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string | null;
  patientName: string | null;
  onCancelled?: () => void;
}

export function CancelAppointmentDialog({
  open,
  onOpenChange,
  appointmentId,
  patientName,
  onCancelled,
}: CancelAppointmentDialogProps) {
  const { t } = useT();
  const [reason, setReason] = useState('');
  const { cancel, isPending } = useCancelAppointment();

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  async function submit() {
    if (!appointmentId) return;
    try {
      await cancel(appointmentId, reason.trim() || undefined);
      toast.success(
        t('salle.cancel.toastRemoved', {
          name: patientName ?? t('salle.cancel.toastDefaultName'),
        }),
      );
      onCancelled?.();
      onOpenChange(false);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        t('salle.cancel.err');
      toast.error(msg);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100 }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            padding: 22,
            width: 'min(420px, 92vw)',
            zIndex: 101,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <Dialog.Title style={{ fontSize: 15, fontWeight: 600, margin: 0, flex: 1 }}>
              {t('salle.cancel.title')}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label={t('common.close')}>
                <Close />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 14 }}>
            {patientName
              ? t('salle.cancel.descNamed', { name: patientName })
              : t('salle.cancel.descGeneric')}
            <br />
            <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>
              {t('salle.cancel.statusNotePre')}{' '}
              <strong>{t('salle.cancel.statusCancelled')}</strong>.
            </span>
          </Dialog.Description>

          <label style={{ fontSize: 11.5, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}>
            {t('salle.cancel.reasonLabel')}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('salle.cancel.reasonPlaceholder')}
            rows={3}
            style={{
              width: '100%',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: 8,
              fontSize: 13,
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
            <Dialog.Close asChild>
              <Button>{t('salle.cancel.keep')}</Button>
            </Dialog.Close>
            <Button
              variant="danger"
              onClick={() => void submit()}
              disabled={isPending || !appointmentId}
            >
              {isPending ? t('salle.cancel.removing') : t('salle.remove')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
