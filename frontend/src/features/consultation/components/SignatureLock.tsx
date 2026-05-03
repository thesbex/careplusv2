/**
 * "Signer et verrouiller" button + confirmation dialog.
 * On confirm, validates the SOAP form via handleSign (which runs the stricter
 * schema check in the parent), then calls POST /api/consultations/{id}/sign.
 */
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/Button';
import { Lock, Close } from '@/components/icons';

interface SignatureLockProps {
  onConfirm: () => Promise<boolean>;
  isSigning: boolean;
  signed: boolean;
  disabled?: boolean;
}

export function SignatureLock({ onConfirm, isSigning, signed, disabled }: SignatureLockProps) {
  const [open, setOpen] = useState(false);

  async function handleConfirm() {
    const ok = await onConfirm();
    if (ok) setOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="primary" disabled={signed || disabled}>
          <Lock /> {signed ? 'Consultation signée' : 'Clôturer et facturer →'}
        </Button>
      </Dialog.Trigger>

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
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)',
            padding: 24,
            width: 400,
            zIndex: 101,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <Dialog.Title style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
              Signer et verrouiller la consultation
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label="Fermer">
                <Close />
              </Button>
            </Dialog.Close>
          </div>

          <Dialog.Description
            style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 20 }}
          >
            Cette action va verrouiller la consultation. Les notes SOAP ne pourront plus être
            modifiées et une facture brouillon sera générée automatiquement.
          </Dialog.Description>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Dialog.Close asChild>
              <Button>Annuler</Button>
            </Dialog.Close>
            <Button
              variant="primary"
              disabled={isSigning}
              onClick={() => {
                void handleConfirm();
              }}
            >
              <Lock /> {isSigning ? 'Signature…' : 'Confirmer et clôturer'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
