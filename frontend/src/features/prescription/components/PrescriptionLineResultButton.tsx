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
import { useT } from '@/lib/i18n/I18nProvider';
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
  const { t } = useT();
  const { attach, isPending: uploading } = useAttachPrescriptionResult();
  const { detach, isPending: deleting } = useDetachPrescriptionResult();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function onFile(file: File) {
    try {
      await attach({ lineId, file });
      toast.success(t('presc.lineResult.ok.attached'));
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;
      if (status === 415) {
        toast.error(t('presc.lineResult.err.badFormat'), {
          description: t('presc.lineResult.err.badFormatDesc'),
        });
      } else if (status === 413) {
        toast.error(t('presc.lineResult.err.tooBig'));
      } else {
        toast.error(t('presc.lineResult.err.uploadFailed'), {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    }
  }

  async function onDetach() {
    try {
      await detach(lineId);
      toast.success(t('presc.lineResult.ok.detached'));
    } catch {
      toast.error(t('presc.lineResult.err.detachFailed'));
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
      toast.error(t('presc.lineResult.err.openFailed'));
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
          📄 {t('presc.lineResult.view')}
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
                {t('presc.lineResult.confirm')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingDelete(false)}
              >
                {t('presc.lineResult.cancel')}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingDelete(true)}
              aria-label={t('presc.lineResult.removeAria')}
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
      uploadLabel={t('presc.lineResult.upload')}
      cameraLabel={t('presc.lineResult.camera')}
      disabled={disabled || uploading}
      variant="default"
      onFile={onFile}
    />
  );
}
