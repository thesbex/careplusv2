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
import { api } from '@/lib/api/client';
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

  // R028 — fetch en blob via axios pour passer le Bearer JWT in-memory
  // (cf. ADR-019). Avant : <a href="/api/documents/.../content"> → le browser
  // ouvrait un nouvel onglet sans token et l'API renvoyait 401 UNAUTHORIZED.
  // Même pattern que QueuePage.viewResult (DRY au cas par cas, lib utilitaire
  // à extraire si on retombe une 3e fois sur ce besoin).
  async function viewResult(documentId: string) {
    try {
      const res = await api.get(`/documents/${documentId}/content`, {
        responseType: 'arraybuffer',
      });
      const ctype = (res.headers['content-type'] as string) ?? 'application/octet-stream';
      const blob = new Blob([res.data as ArrayBuffer], { type: ctype });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error("Impossible d'ouvrir le résultat.");
    }
  }

  if (resultDocumentId) {
    return (
      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => void viewResult(resultDocumentId)}
          style={{
            background: 'transparent',
            border: 0,
            padding: 0,
            font: 'inherit',
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--accent, #0ea5e9)',
            textDecoration: 'underline',
          }}
        >
          📄 Voir résultat
        </button>
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
