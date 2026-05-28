/**
 * ConsentUploadDialog — upload d'un consentement déjà signé (scan PDF/photo).
 *
 * User request 2026-05-28 : « charger un consentement pour le faire signer
 * par le patient, pour le scanner par la suite, et l'intégrer au dossier
 * du client ». ConsentDialog couvre la génération (PDF vierge à imprimer
 * pour signature manuelle). Ce dialog couvre l'aller-retour : on scanne
 * le consentement signé et on l'attache au dossier patient + à la
 * consultation courante (type=CONSENTEMENT).
 */
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Close } from '@/components/icons';
import { DocumentUploadButton } from '@/components/ui/DocumentUploadButton';
import { usePatientDocuments } from '@/features/dossier-patient/hooks/usePatientDocuments';

interface ConsentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  /** Id de la consultation courante — injecté dans `notes` pour traçabilité. */
  consultationId?: string;
}

export function ConsentUploadDialog({ open, onOpenChange, patientId, consultationId }: ConsentUploadDialogProps) {
  const { upload } = usePatientDocuments(patientId);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    if (busy) return;
    setBusy(true);
    try {
      const annotation = [
        notes.trim(),
        consultationId ? `Rattaché à la consultation ${consultationId}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      await upload({
        file,
        type: 'CONSENTEMENT',
        ...(annotation ? { notes: annotation } : {}),
      });
      toast.success('Consentement signé attaché au dossier.');
      onOpenChange(false);
      setNotes('');
    } catch (err) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Échec de l'envoi. Vérifiez le format (PDF/JPEG/PNG) et la taille (< 10 Mo).";
      toast.error(msg);
    } finally {
      setBusy(false);
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
            width: 'min(540px, 94vw)',
            maxHeight: '90vh',
            overflowY: 'auto',
            zIndex: 101,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <Dialog.Title style={{ fontSize: 15, fontWeight: 600, margin: 0, flex: 1 }}>
              Importer un consentement signé
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label="Fermer">
                <Close />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 14, lineHeight: 1.55 }}>
            Téléverser ou photographier le consentement signé par le patient. Le document
            sera rangé dans le dossier sous le type <strong>Consentement signé</strong>
            {consultationId ? ' et lié à la consultation en cours' : ''}.
          </Dialog.Description>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, marginBottom: 12 }}>
            <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>Note (optionnel)</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ex. Consentement opératoire — Dr El Amrani"
              aria-label="Note"
              style={{
                height: 34, padding: '0 10px',
                border: '1px solid var(--border)', borderRadius: 6,
                fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)',
              }}
            />
          </label>

          <div style={{
            border: '1px dashed var(--border)',
            borderRadius: 8,
            padding: 16,
            textAlign: 'center',
            background: 'var(--surface-2)',
          }}>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 10, fontWeight: 500 }}>
              Choisir le fichier à attacher
            </div>
            <DocumentUploadButton
              onFile={(f) => { void handleFile(f); }}
              disabled={busy}
              variant="primary"
            />
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8 }}>
              PDF, JPEG, PNG · 10 Mo max
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <Dialog.Close asChild>
              <Button>Annuler</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
