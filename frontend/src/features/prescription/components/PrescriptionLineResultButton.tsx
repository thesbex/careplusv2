/**
 * PrescriptionLineResultButton — bouton « Téléverser résultat » à côté
 * d'une ligne de prescription LAB / IMAGING (V015).
 *
 * États :
 *   - Pas de résultat : « Téléverser résultat » + « Photographier »
 *     (DocumentUploadButton — webcam sur PC, capture sur mobile).
 *   - Résultat attaché : lien « Voir résultat » (ouvre le PDF/image
 *     dans un onglet) + bouton ⌫ pour détacher.
 *
 * Le composant ne s'affiche que pour les lignes LAB/IMAGING (DRUG
 * exclu côté parent — l'API renverrait sinon un 400 RESULT_NOT_APPLICABLE).
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { DocumentUploadButton } from '@/components/ui/DocumentUploadButton';
import { Button } from '@/components/ui/Button';
import { Trash } from '@/components/icons';
import {
  useAttachPrescriptionResult,
  useDetachPrescriptionResult,
} from '../hooks/usePrescriptionResult';

interface Props {
  lineId: string;
  resultDocumentId: string | null;
  /** Si true : composant désactivé (consultation signée, pas de droit, …). */
  disabled?: boolean;
}

export function PrescriptionLineResultButton({ lineId, resultDocumentId, disabled = false }: Props) {
  const { attach, isPending: uploading } = useAttachPrescriptionResult();
  const { detach, isPending: deleting } = useDetachPrescriptionResult();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function onFile(file: File) {
    try {
      await attach({ lineId, file });
      toast.success('Résultat attaché.');
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;
      if (status === 415) {
        toast.error('Format non supporté', {
          description: 'Acceptés : PDF, JPEG, PNG, WebP, HEIC.',
        });
      } else if (status === 413) {
        toast.error('Fichier trop volumineux (max 10 Mo).');
      } else {
        toast.error('Échec du téléversement', {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    }
  }

  async function onDetach() {
    try {
      await detach(lineId);
      toast.success('Résultat retiré.');
    } catch {
      toast.error('Échec de la suppression.');
    } finally {
      setConfirmingDelete(false);
    }
  }

  if (resultDocumentId) {
    return (
      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <a
          href={`/api/documents/${resultDocumentId}/content`}
          target="_blank"
          rel="noreferrer noopener"
          style={{
            fontSize: 13,
            color: 'var(--accent, #0ea5e9)',
            textDecoration: 'underline',
          }}
        >
          📄 Voir résultat
        </a>
        {!disabled && (
          confirmingDelete ? (
            <>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={deleting}
                onClick={onDetach}
              >
                Confirmer
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingDelete(false)}
              >
                Annuler
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingDelete(true)}
              aria-label="Retirer le résultat"
            >
              <Trash style={{ width: 12, height: 12 }} />
            </Button>
          )
        )}
      </div>
    );
  }

  return (
    <DocumentUploadButton
      uploadLabel="Téléverser résultat"
      cameraLabel="Photographier résultat"
      disabled={disabled || uploading}
      variant="default"
      onFile={onFile}
    />
  );
}
