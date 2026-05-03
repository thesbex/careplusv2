/**
 * "Signer et verrouiller" button + confirmation dialog.
 * Uses @radix-ui/react-dialog (already in package.json per ADR-015).
 * The dialog provides: focus trap, Escape to close, WAI-ARIA roles.
 *
 * Copy is verbatim from the prototype footer bar (consultation.jsx line 93–102).
 * Sign action is handled by useSignConsultation (mock until backend J5).
 */
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/Button';
import { Lock, Close } from '@/components/icons';
import { useSignConsultation } from '../hooks/useSignConsultation';

interface SignatureLockProps {
  consultationId?: string;
}

export function SignatureLock({ consultationId }: SignatureLockProps) {
  const { sign, isSigning, signed } = useSignConsultation();

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="primary" disabled={signed}>
          <Lock /> {signed ? 'Consultation signée' : 'Clôturer et facturer →'}
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 100,
          }}
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
            <Dialog.Title
              style={{ fontSize: 15, fontWeight: 600, margin: 0 }}
            >
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
            modifiées. Une facture de <strong>250,00 MAD</strong> sera générée.
          </Dialog.Description>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Dialog.Close asChild>
              <Button>Annuler</Button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <Button
                variant="primary"
                disabled={isSigning}
                onClick={() => sign(consultationId)}
              >
                <Lock /> Confirmer et clôturer
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
