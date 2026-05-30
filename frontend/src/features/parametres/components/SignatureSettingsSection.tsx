/**
 * F16 + V035 — section "Ma signature scannée" (per-médecin depuis 2026-05-08).
 *
 * Avant : signature cabinet, ADMIN-seul. Maintenant : chaque utilisateur gère
 * la sienne. Le composant accepte un `practitionerId` optionnel pour qu'un
 * ADMIN puisse aussi modifier celle d'un autre médecin (utile pour onboarding) ;
 * sans argument il opère sur l'utilisateur connecté.
 *
 * Workflow :
 *   1. Aperçu de la signature actuelle (ou message vide).
 *   2. Bouton "Téléverser" → input file caché → upload immédiat.
 *   3. Bouton "Supprimer" si une signature existe (confirm natif).
 *
 * Validation côté frontend = double sécurité du backend (mêmes règles) :
 *   - MIME ∈ {image/png, image/jpeg, image/webp}
 *   - taille ≤ 500 Ko
 */
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import {
  useSignatureMeta,
  useSignaturePreviewUrl,
  useUploadSignature,
  useDeleteSignature,
} from '../hooks/useSignature';
import { useT } from '@/lib/i18n/I18nProvider';

const MAX_BYTES = 500 * 1024;
const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ACCEPT_ATTR = '.png,.jpg,.jpeg,.webp';

export interface SignatureSettingsSectionProps {
  /** Optionnel : ADMIN peut éditer la signature d'un autre médecin via cet id. */
  practitionerId?: string;
}

export function SignatureSettingsSection({ practitionerId }: SignatureSettingsSectionProps = {}) {
  const { t } = useT();
  const { meta, isLoading } = useSignatureMeta(practitionerId);
  const previewUrl = useSignaturePreviewUrl(meta, practitionerId);
  const { upload, isPending: isUploading } = useUploadSignature(practitionerId);
  const { remove, isPending: isDeleting } = useDeleteSignature(practitionerId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handlePick() {
    fileRef.current?.click();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permet de re-sélectionner le même fichier
    if (!file) return;

    setErrorMsg(null);
    if (!ALLOWED_MIMES.has(file.type)) {
      setErrorMsg(t('settings.sig.badFormat'));
      return;
    }
    if (file.size > MAX_BYTES) {
      setErrorMsg(t('settings.sig.tooBig'));
      return;
    }
    try {
      await upload(file);
      toast.success(t('settings.sig.updated'));
    } catch {
      toast.error(t('settings.sig.uploadErr'));
    }
  }

  async function handleRemove() {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('settings.sig.confirmRemove'))) return;
    try {
      await remove();
      toast.success(t('settings.sig.removed'));
    } catch {
      toast.error(t('settings.sig.removeErr'));
    }
  }

  const hasSignature = !!meta;

  return (
    <Panel style={{ marginTop: 16 }}>
      <PanelHeader>{t('settings.sig.title')}</PanelHeader>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          {t('settings.sig.hint')}
          <br />
          {t('settings.sig.hint2')}
        </div>

        <div
          data-testid="signature-preview"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 110,
            padding: 14,
            background: 'var(--surface-2)',
            border: '1px dashed var(--border)',
            borderRadius: 6,
          }}
        >
          {isLoading && (
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t('common.loading')}</span>
          )}
          {!isLoading && hasSignature && previewUrl && (
            <img
              src={previewUrl}
              alt={t('settings.sig.title')}
              style={{ maxWidth: 240, maxHeight: 90, objectFit: 'contain' }}
            />
          )}
          {!isLoading && hasSignature && !previewUrl && (
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t('common.loading')}</span>
          )}
          {!isLoading && !hasSignature && (
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {t('settings.sig.none')}
            </span>
          )}
        </div>

        {errorMsg && (
          <div style={{ color: 'var(--danger)', fontSize: 12 }}>{errorMsg}</div>
        )}

        {meta && (
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            {t('settings.fileMeta', { mime: meta.mime, size: (meta.sizeBytes / 1024).toFixed(1) })}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_ATTR}
          onChange={(e) => {
            void handleFile(e);
          }}
          style={{ display: 'none' }}
          data-testid="signature-file-input"
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {hasSignature && (
            <Button
              variant="ghost"
              disabled={isDeleting || isUploading}
              onClick={() => {
                void handleRemove();
              }}
            >
              {isDeleting ? t('common.deleting') : t('common.delete')}
            </Button>
          )}
          <Button
            variant="primary"
            disabled={isUploading || isDeleting}
            onClick={handlePick}
          >
            {isUploading
              ? t('common.uploading')
              : hasSignature
                ? t('settings.sig.replace')
                : t('settings.sig.upload')}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
